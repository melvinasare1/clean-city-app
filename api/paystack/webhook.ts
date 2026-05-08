import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import {
  addCalendarMonth,
  toDate,
  createJobForOneTimeBooking,
  createJobsForSubscription,
} from './subscription-helpers';
import type {
  JobAddressSnapshot,
  JobCollectionFrequency,
  JobItemSnapshot,
} from './payment-and-job-types';
import { getBookingById } from './bookings';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * POST /api/paystack/webhook
 * 
 * Paystack webhook handler for transaction events
 * Validates signature and optionally writes to Firestore if Firebase Admin is configured
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PAYSTACK_SECRET_KEY) {
    console.error('PAYSTACK_SECRET_KEY not configured');
    return res.status(500).json({
      error: 'Server configuration error',
    });
  }

  try {
    // Get signature from header
    const signature = req.headers['x-paystack-signature'] as
      | string
      | undefined;

    if (!signature) {
      console.error('Missing x-paystack-signature header');
      return res.status(400).json({ error: 'Missing signature header' });
    }

    // Paystack signs the exact request bytes; Vercel parses JSON first — use raw string when present.
    const rawBody =
      typeof req.body === "string"
        ? Buffer.from(req.body, "utf8")
        : Buffer.isBuffer(req.body)
          ? req.body
          : Buffer.from(JSON.stringify(req.body ?? {}), "utf8");

    // Verify signature
    const hash = crypto
      .createHmac('sha512', PAYSTACK_SECRET_KEY)
      .update(rawBody)
      .digest('hex');

    if (hash !== signature) {
      console.error('Invalid Paystack webhook signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Parse event
    const event = req.body as any;
    const eventName = event?.event;

    if (!eventName) {
      console.warn('Webhook event missing event name');
      return res.status(400).json({ error: 'Invalid event payload' });
    }

    console.log(`Paystack webhook event: ${eventName}`, {
      reference: event?.data?.reference,
      status: event?.data?.status,
    });

    // Optionally write to Firestore if Firebase Admin is configured
    try {
      // Try to use Firebase Admin if available
      // This is optional - if not configured, we just log
      const admin = await import('firebase-admin').catch(() => null);

      if (admin && admin.apps.length === 0) {
        // Try to initialize if not already initialized
        try {
          if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(
              process.env.FIREBASE_SERVICE_ACCOUNT_JSON
            );
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
          } else {
            // Try application default credentials
            admin.initializeApp({
              credential: admin.credential.applicationDefault(),
            });
          }
        } catch (initError) {
          console.warn('Firebase Admin not configured, skipping Firestore write:', initError);
        }
      }

      if (admin && admin.apps.length > 0) {
        const firestore = admin.firestore();
        const FieldValue = admin.firestore.FieldValue;

        // Handle transaction events
        if (
          eventName === 'charge.success' ||
          eventName === 'charge.failed' ||
          eventName === 'charge.abandoned'
        ) {
          const paystackData = event.data;
          const reference =
            typeof paystackData?.reference === "string" && paystackData.reference.trim() !== ""
              ? paystackData.reference.trim()
              : typeof paystackData?.transaction_reference === "string" &&
                  paystackData.transaction_reference.trim() !== ""
                ? paystackData.transaction_reference.trim()
                : null;
          if (reference) {
            const amountKobo = paystackData.amount || 0;
            const amount = amountKobo / 100;
            const currency = paystackData.currency || 'GHS';
            const status = (paystackData.status || 'pending') as
              | 'success'
              | 'failed'
              | 'abandoned'
              | 'pending';
            const metadata = paystackData.metadata || {};

            const docRef = firestore.collection('transactions').doc(reference);
            const snapshot = await docRef.get();
            const existing = snapshot.exists ? snapshot.data() : null;

            // Idempotency: don't downgrade from success
            if (existing && existing.status === 'success' && status !== 'success') {
              console.log(`Skipping downgrade for transaction ${reference}`);
              return res.status(200).json({ received: true });
            }

            // Store transaction with metadata preserved exactly as sent (includes type, subscriptionId/bookingId)
            await docRef.set(
              {
                userId: metadata?.userId ?? existing?.userId ?? null,
                bookingId: metadata?.bookingId ?? existing?.bookingId ?? null,
                metadata: metadata ?? existing?.metadata ?? {},
                reference,
                amount,
                currency,
                status,
                rawPaystack: event,
                createdAt:
                  existing?.createdAt ?? FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            // Update payments collection (doc id = reference, normally created on initialize).
            // Always merge so a successful webhook still records status if initialize missed Firestore.
            const paymentStatus = status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'abandoned';
            const paymentRef = firestore.collection('payments').doc(reference);
            await paymentRef.set(
              {
                status: paymentStatus,
                paystackStatus: status,
                reference,
                ...(metadata?.bookingId != null && metadata.bookingId !== ''
                  ? { bookingId: String(metadata.bookingId) }
                  : {}),
                ...(metadata?.userId != null && metadata.userId !== ''
                  ? { userId: String(metadata.userId) }
                  : {}),
                ...(metadata?.type != null && metadata.type !== ''
                  ? { type: String(metadata.type) }
                  : {}),
                ...(metadata?.subscriptionId != null && metadata.subscriptionId !== ''
                  ? { subscriptionId: String(metadata.subscriptionId) }
                  : {}),
                updatedAt: FieldValue.serverTimestamp(),
              },
              { merge: true }
            );

            const paymentType = metadata?.type;

            if (status === 'success') {
              if (paymentType === 'one_time') {
                const bookingId = metadata?.bookingId;
                if (bookingId) {
                  try {
                    await firestore
                      .collection('bookings')
                      .doc(bookingId)
                      .set(
                        {
                          payment: {
                            status: 'paid',
                            reference,
                            paidAt: FieldValue.serverTimestamp(),
                          },
                        },
                        { merge: true }
                      );
                    console.log(`Booking ${bookingId} marked as paid`);

                    // Create one job in top-level "jobs" collection (snapshot at creation)
                    const booking = await getBookingById(bookingId);
                    if (booking) {
                      const items: JobItemSnapshot[] = Array.isArray(booking.items)
                        ? (booking.items as any[]).map((i: any, idx: number) => ({
                            id: i?.id ?? (i?.type ? String(i.type).replace(/\s+/g, '_').toUpperCase() : `ITEM_${idx}`),
                            type: String(i?.type ?? ''),
                            quantity: Number(i?.quantity) ?? 0,
                            unitPrice: Number(i?.unitPrice) ?? 0,
                            totalPrice: Number(i?.totalPrice) ?? 0,
                          })).filter((i) => i.type)
                        : [];
                      const loc = (booking as any).location != null ? String((booking as any).location) : '';
                      const meta = (booking as any).metadata && typeof (booking as any).metadata === 'object' ? (booking as any).metadata : {};
                      const addressSnapshot: JobAddressSnapshot = {
                        addressLine1: meta?.addressLine1 ?? (booking as any).addressLine1 ?? loc ?? '',
                        area: meta?.area ?? (booking as any).area ?? '',
                        phoneNumber: meta?.phoneNumber ?? (booking as any).phoneNumber ?? '',
                      };
                      const bookingDate = (booking as any).date;
                      const scheduledDate = bookingDate
                        ? (typeof bookingDate === 'string' ? new Date(bookingDate) : toDate(bookingDate) ?? new Date())
                        : new Date();
                      await createJobForOneTimeBooking(firestore, {
                        bookingId,
                        userId: booking.userId,
                        scheduledDate,
                        items,
                        location: loc,
                        addressSnapshot,
                        windowId: (booking as any).windowId ?? 'morning',
                        windowLabel: (booking as any).windowLabel ?? '',
                        Timestamp: admin.firestore.Timestamp,
                      });
                      console.log(`Job created for one-time booking ${bookingId}`);
                    }
                  } catch (err) {
                    console.error(`Failed to update booking ${bookingId} or create job:`, err);
                  }
                }
              } else if (paymentType === 'subscription') {
                const subscriptionId = metadata?.subscriptionId;
                const userId = metadata?.userId as string | undefined;
                if (subscriptionId && userId) {
                  try {
                    const subRef = firestore.collection('subscriptions').doc(subscriptionId);
                    const subSnap = await subRef.get();
                    if (subSnap.exists) {
                      const now = new Date();
                      const subData = subSnap.data() as Record<string, any>;
                      const wasOverdue = subData?.status === 'overdue';
                      const nextBilling = subData?.nextBillingDate
                        ? addCalendarMonth(toDate(subData.nextBillingDate) ?? now)
                        : addCalendarMonth(now);
                      await subRef.set(
                        {
                          status: 'active',
                          lastPaymentDate: FieldValue.serverTimestamp(),
                          lastPaymentReference: reference,
                          nextBillingDate: nextBilling,
                          paymentDueSince: FieldValue.delete(),
                          currentPaymentReference: FieldValue.delete(),
                          payment: {
                            status: 'paid',
                            reference,
                          },
                          updatedAt: FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                      );
                      console.log(`Subscription ${subscriptionId} charge.success: nextBilling=${nextBilling.toISOString()}`);

                      // Generate jobs only after successful payment; do not generate if subscription was overdue
                      if (!wasOverdue) {
                        const collectionFrequency = (subData?.collectionFrequency ?? 'monthly') as JobCollectionFrequency;
                        const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const meta = subData?.metadata && typeof subData.metadata === 'object' ? subData.metadata : {};
                        const addressSnapshot: JobAddressSnapshot = {
                          addressLine1: meta?.addressLine1 ?? subData?.location ?? '',
                          area: meta?.area ?? '',
                          phoneNumber: meta?.phoneNumber ?? '',
                        };
                        const subItems = Array.isArray(subData?.items) ? subData.items : [];
                        const items: JobItemSnapshot[] = subItems.map((i: any, idx: number) => ({
                          id: i?.id ?? (i?.type ? String(i.type).replace(/\s+/g, '_').toUpperCase() : `ITEM_${idx}`),
                          type: String(i?.type ?? ''),
                          quantity: Number(i?.quantity) ?? 0,
                          unitPrice: Number(i?.unitPrice) ?? 0,
                          totalPrice: Number(i?.totalPrice) ?? 0,
                        })).filter((i: JobItemSnapshot) => i.type);
                        const location = subData?.location != null ? String(subData.location) : '';
                        await createJobsForSubscription(firestore, {
                          subscriptionId,
                          userId,
                          billingPeriodStart,
                          collectionFrequency,
                          collectionDay: subData?.collectionDay ?? undefined,
                          items,
                          location,
                          addressSnapshot,
                          windowId: subData?.windowId ?? meta?.windowId ?? 'morning',
                          windowLabel: subData?.windowLabel ?? meta?.windowLabel ?? '',
                          Timestamp: admin.firestore.Timestamp,
                        });
                        console.log(`Jobs created for subscription ${subscriptionId} (${collectionFrequency})`);
                      }
                    }
                  } catch (err) {
                    console.error(`Failed to update subscription ${subscriptionId}:`, err);
                  }
                }
              }
            } else if (status === 'failed' && paymentType === 'subscription') {
              const subscriptionId = metadata?.subscriptionId;
              if (subscriptionId) {
                try {
                  await firestore
                    .collection('subscriptions')
                    .doc(subscriptionId)
                    .set(
                      { status: 'overdue', updatedAt: FieldValue.serverTimestamp() },
                      { merge: true }
                    );
                  console.log(`Subscription ${subscriptionId} charge.failed: status=overdue`);
                } catch (err) {
                  console.error(`Failed to update subscription ${subscriptionId}:`, err);
                }
              }
            }

            console.log(`Transaction ${reference} saved to Firestore`);
          }
        }
      }
    } catch (firestoreError) {
      // Log but don't fail - webhook should return 200 even if Firestore write fails
      console.error('Error writing to Firestore (non-fatal):', firestoreError);
    }

    // Always return 200 to acknowledge receipt
    return res.status(200).json({ received: true });
  } catch (error: any) {
    console.error('Error handling Paystack webhook:', error?.message);
    return res.status(500).json({
      error: 'Internal server error',
      details: error?.message || 'Unknown error',
    });
  }
}


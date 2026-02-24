import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';
import {
  addCalendarMonth,
  toDate,
  createJobsForSubscription,
} from './subscription-helpers';
import type { JobCollectionFrequency } from './payment-and-job-types';

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

    // Get raw body for signature verification
    // Note: Vercel automatically parses JSON, so we reconstruct the raw body.
    // JSON.stringify should produce the same string Paystack sent (deterministic).
    // If signature verification fails, you may need to configure Vercel to not parse
    // the body for this route (see vercel.json configuration).
    const rawBody = Buffer.from(JSON.stringify(req.body));

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
          if (paystackData?.reference) {
            const reference = paystackData.reference;
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

            // Update payments collection (doc id = reference, created on initialize)
            const paymentStatus = status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'abandoned';
            const paymentRef = firestore.collection('payments').doc(reference);
            const paymentSnap = await paymentRef.get();
            if (paymentSnap.exists) {
              await paymentRef.set(
                {
                  status: paymentStatus,
                  paystackStatus: status,
                  updatedAt: FieldValue.serverTimestamp(),
                },
                { merge: true }
              );
            }

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
                        { payment: { status: 'paid' } },
                        { merge: true }
                      );
                    console.log(`Booking ${bookingId} marked as paid`);
                  } catch (err) {
                    console.error(`Failed to update booking ${bookingId} payment:`, err);
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
                      const subData = subSnap.data();
                      const wasOverdue = subData?.status === 'overdue';
                      const nextBilling = subData?.nextBillingDate
                        ? addCalendarMonth(toDate(subData.nextBillingDate as any) ?? now)
                        : addCalendarMonth(now);
                      await subRef.set(
                        {
                          status: 'active',
                          lastPaymentDate: FieldValue.serverTimestamp(),
                          lastPaymentReference: reference,
                          nextBillingDate: nextBilling,
                          paymentDueSince: FieldValue.delete(),
                          currentPaymentReference: FieldValue.delete(),
                          updatedAt: FieldValue.serverTimestamp(),
                        },
                        { merge: true }
                      );
                      console.log(`Subscription ${subscriptionId} charge.success: nextBilling=${nextBilling.toISOString()}`);

                      // Generate jobs only after successful payment; do not generate if subscription was overdue
                      if (!wasOverdue) {
                        const collectionFrequency = (subData?.collectionFrequency ?? 'monthly') as JobCollectionFrequency;
                        const billingPeriodStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        const addressSnapshot: Record<string, unknown> =
                          typeof subData?.metadata === 'object' && subData.metadata !== null
                            ? { ...(subData.metadata as Record<string, unknown>) }
                            : {};
                        await createJobsForSubscription(firestore, {
                          subscriptionId,
                          userId,
                          billingPeriodStart,
                          collectionFrequency,
                          addressSnapshot,
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


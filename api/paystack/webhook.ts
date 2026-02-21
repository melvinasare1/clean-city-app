import type { VercelRequest, VercelResponse } from '@vercel/node';
import crypto from 'crypto';

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

            await docRef.set(
              {
                userId: metadata?.userId ?? existing?.userId ?? null,
                bookingId: metadata?.bookingId ?? existing?.bookingId ?? null,
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

            // If payment was successful, mark booking payment as paid
            if (status === 'success' && metadata?.bookingId) {
              try {
                await firestore
                  .collection('bookings')
                  .doc(metadata.bookingId)
                  .set(
                    { 
                      payment: { status: 'paid' }
                    }, 
                    { merge: true }
                  );
                console.log(`Marked booking ${metadata.bookingId} payment as paid`);
              } catch (err) {
                console.error(
                  `Failed to update booking ${metadata.bookingId} payment:`,
                  err
                );
              }
            }

            // Simulated subscription: when charge.success has subscriptionId, update subscription doc
            if (status === 'success' && metadata?.subscriptionId) {
              const subscriptionId = String(metadata.subscriptionId);
              try {
                const subRef = firestore.collection('subscriptions').doc(subscriptionId);
                const subSnap = await subRef.get();
                if (subSnap.exists) {
                  const subData = subSnap.data() || {};
                  const interval = subData.interval === 'monthly' ? 'monthly' : 'weekly';
                  const now = new Date();
                  const next = new Date(now);
                  if (interval === 'monthly') {
                    next.setMonth(next.getMonth() + 1);
                  } else {
                    next.setDate(next.getDate() + 7);
                  }
                  await subRef.set(
                    {
                      payment: { status: 'paid', reference },
                      lastChargeDate: FieldValue.serverTimestamp(),
                      nextChargeDate: next,
                      status: 'active',
                      updatedAt: FieldValue.serverTimestamp(),
                    },
                    { merge: true }
                  );
                  console.log(`Updated subscription ${subscriptionId} payment as paid, nextCharge: ${next.toISOString()}`);
                }
              } catch (err) {
                console.error(`Failed to update subscription ${metadata.subscriptionId}:`, err);
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


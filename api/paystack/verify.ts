import type { VercelRequest, VercelResponse } from "@vercel/node";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * GET /api/paystack/verify?reference=...
 * POST /api/paystack/verify (with body.reference OR body.bookingId)
 *
 * Verify a Paystack transaction by reference or bookingId
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!PAYSTACK_SECRET_KEY) {
    return res.status(500).json({
      error: "Server configuration error",
      message: "PAYSTACK_SECRET_KEY not configured",
    });
  }

  try {
    // Normalize body (Vercel may parse JSON; ensure we have an object)
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body) as Record<string, unknown>;
      } catch {
        body = {};
      }
    }
    if (!body || typeof body !== "object") {
      body = {};
    }

    // Get reference or bookingId from query or body
    const directReference =
      (req.query.reference as string | undefined) ||
      (body.reference as string | undefined);

    let bookingId = body.bookingId;
    if (bookingId != null && typeof bookingId !== "string") {
      bookingId = String(bookingId).trim();
    } else if (typeof bookingId === "string") {
      bookingId = bookingId.trim();
    } else {
      bookingId = undefined;
    }

    let reference = directReference;

    // Require either reference or a non-empty bookingId string for POST
    if (!reference) {
      if (bookingId === undefined || bookingId === null || bookingId === "") {
        return res.status(400).json({
          ok: false,
          error: "bookingId is required and must be a string",
        });
      }
    }

    // If bookingId is provided instead of reference, look up the booking in Firestore
    if (!reference && bookingId) {
      try {
        // Lazy load Firebase Admin SDK only if needed
        const admin = await import('firebase-admin');
        
        // Initialize Firebase Admin if not already initialized
        if (admin.apps.length === 0) {
          if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
            admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
            });
          } else {
            admin.initializeApp({
              credential: admin.credential.applicationDefault(),
            });
          }
        }

        const firestore = admin.firestore();
        const bookingDoc = await firestore.collection('bookings').doc(bookingId).get();
        
        if (!bookingDoc.exists) {
          return res.status(404).json({
            ok: false,
            error: "Booking not found",
          });
        }

        const bookingData = bookingDoc.data();
        reference = bookingData?.payment?.reference;

        if (!reference) {
          return res.status(400).json({
            ok: false,
            error: "No payment reference found for this booking",
          });
        }

        console.log(`[Verify] Looked up booking ${bookingId}, found reference: ${reference}`);
      } catch (firebaseError: any) {
        console.error("[Verify] Firebase lookup error:", firebaseError);
        return res.status(500).json({
          ok: false,
          error: "Failed to lookup booking",
          details: firebaseError.message,
        });
      }
    }

    if (!reference) {
      return res.status(400).json({
        ok: false,
        error: "reference or bookingId is required",
      });
    }

    // Call Paystack API
    const paystackResponse = await fetch(
      `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        },
      }
    );

    const data = await paystackResponse.json();

    if (!paystackResponse.ok || !data.status) {
      console.error("Paystack verify error:", data);
      
      // If this was a bookingId verification, return error in expected format
      if (bookingId) {
        return res.status(200).json({
          ok: false,
          paid: false,
          error: data.message || "Transaction not found or verification failed",
        });
      }
      
      return res.status(paystackResponse.status || 500).json({
        error: "Failed to verify transaction",
        details: data.message || "Unknown error",
      });
    }

    const paystackData = data.data;

    console.log("paystackData", paystackData.amount);
    // Normalize response
    const status = (paystackData.status || "failed") as
      | "success"
      | "failed"
      | "abandoned"
      | "pending";

    const isPaid = status === "success";

    // If request was made with bookingId, return simplified format expected by app
    if (bookingId) {
      return res.status(200).json({
        ok: true,
        paid: isPaid,
        status,
        reference: paystackData.reference,
        amount: paystackData.amount / 100, // convert from kobo to main currency
        currency: paystackData.currency,
      });
    }

    // Otherwise return full format for direct reference verification
    return res.status(200).json({
      status,
      reference: paystackData.reference,
      amount: paystackData.amount, // convert from smallest unit
      currency: paystackData.currency,
      statusMessage: paystackData.gateway_response,
      metadata: paystackData.metadata,
      rawPaystack: data,
    });
  } catch (error: any) {
    console.error("Error verifying Paystack transaction:", error?.message);
    
    // If this was a bookingId verification, return error in expected format
    if (bookingId) {
      return res.status(500).json({
        ok: false,
        error: error?.message || "Failed to verify transaction",
      });
    }
    
    return res.status(500).json({
      error: "Failed to verify transaction",
      details: error?.message || "Unknown error",
    });
  }
}

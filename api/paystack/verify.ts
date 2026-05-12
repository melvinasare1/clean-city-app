import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getBookingById } from "./bookings";
import { createJobForOneTimeBooking, toDate } from "./subscription-helpers";
import type { JobAddressSnapshot, JobItemSnapshot } from "./payment-and-job-types";
import { getFirestore, FieldValue } from "../lib/firebase-admin";

const PAYSTACK_BASE_URL = "https://api.paystack.co";
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const JOBS_COLLECTION = "jobs";
const PAYMENTS_COLLECTION = "payments";

function pickQueryParam(
  value: string | string[] | undefined
): string {
  if (value == null) return "";
  const s = Array.isArray(value) ? String(value[0] ?? "") : String(value);
  return s.trim();
}

async function resolveReferenceFromSubscriptionId(
  firestore: import("firebase-admin").firestore.Firestore,
  subscriptionId: string
): Promise<string | undefined> {
  try {
    const subSnap = await firestore.collection("subscriptions").doc(subscriptionId).get();
    if (!subSnap.exists) return undefined;
    const d = subSnap.data() as Record<string, unknown>;
    const payment = d?.payment as { reference?: string; status?: string } | undefined;
    const refPay = typeof payment?.reference === "string" ? payment.reference.trim() : "";
    const refLast =
      typeof d?.lastPaymentReference === "string" ? d.lastPaymentReference.trim() : "";
    const refCurrent =
      typeof d?.currentPaymentReference === "string" ? d.currentPaymentReference.trim() : "";
    const refDirect = typeof d?.reference === "string" ? d.reference.trim() : "";
    // Prefer nested payment + lastPaymentReference (webhook) over root reference so verify
    // matches the transaction Paystack knows after charge.success (currentPaymentReference is deleted).
    const combined = refPay || refLast || refCurrent || refDirect;
    return combined || undefined;
  } catch (e) {
    console.error("[Verify] subscription reference lookup failed:", e);
    return undefined;
  }
}

/**
 * When the booking doc never received `payment.reference` (e.g. client closed before
 * Firestore write), resolve the latest Paystack reference from `payments/{ref}` docs
 * created at initialize (they store `bookingId`).
 */
async function resolveReferenceFromPaymentsCollection(
  firestore: import("firebase-admin").firestore.Firestore,
  bookingId: string
): Promise<string | undefined> {
  try {
    const snap = await firestore
      .collection(PAYMENTS_COLLECTION)
      .where("bookingId", "==", bookingId)
      .limit(25)
      .get();
    if (snap.empty) return undefined;

    type Scored = { ref: string; t: number };
    const scored: Scored[] = [];
    for (const d of snap.docs) {
      const data = d.data() as Record<string, unknown>;
      const refRaw =
        typeof data.reference === "string" && data.reference.trim() !== ""
          ? data.reference.trim()
          : d.id;
      if (!refRaw) continue;
      const createdAt = data.createdAt as { toMillis?: () => number } | undefined;
      const t = typeof createdAt?.toMillis === "function" ? createdAt.toMillis() : 0;
      scored.push({ ref: refRaw, t });
    }
    if (!scored.length) return undefined;
    scored.sort((a, b) => b.t - a.t);
    return scored[0].ref;
  } catch (e) {
    console.error("[Verify] payments collection lookup failed:", e);
    return undefined;
  }
}

/**
 * GET /api/paystack/verify?reference=...&subscriptionId=...&bookingId=...
 * POST /api/paystack/verify (with body.reference OR body.bookingId OR body.subscriptionId)
 *
 * Verify a Paystack transaction by reference, bookingId, or subscriptionId (subscription resolves reference from Firestore).
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

  let bookingId: string | undefined;

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

    bookingId = body.bookingId as string | undefined;
    if (bookingId == null || bookingId === "") {
      const fromQuery = pickQueryParam(req.query.bookingId as string | string[] | undefined);
      if (fromQuery) bookingId = fromQuery;
    }
    if (bookingId != null && typeof bookingId !== "string") {
      bookingId = String(bookingId).trim();
    } else if (typeof bookingId === "string") {
      bookingId = bookingId.trim();
    } else {
      bookingId = undefined;
    }

    const subscriptionIdFromRequest =
      pickQueryParam(req.query.subscriptionId as string | string[] | undefined) ||
      (typeof (body as Record<string, unknown>).subscriptionId === "string"
        ? String((body as Record<string, unknown>).subscriptionId).trim()
        : "");

    let reference =
      directReference != null && String(directReference).trim() !== ""
        ? String(directReference).trim()
        : undefined;

    // Subscription MoMo: allow GET ?subscriptionId=… (and optional reference) so the app
    // does not depend on POST JSON body parsing.
    if (!reference && subscriptionIdFromRequest) {
      try {
        const firestore = getFirestore();
        const fromSub = await resolveReferenceFromSubscriptionId(
          firestore,
          subscriptionIdFromRequest
        );
        if (fromSub) {
          reference = fromSub;
          console.log(
            `[Verify] Resolved reference from subscription ${subscriptionIdFromRequest}`
          );
        }
      } catch (subLookupErr) {
        console.error("[Verify] subscriptionId lookup error:", subLookupErr);
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

        if (!reference || String(reference).trim() === "") {
          const fromPayments = await resolveReferenceFromPaymentsCollection(
            firestore,
            bookingId
          );
          if (fromPayments) {
            reference = fromPayments;
            console.log(
              `[Verify] Resolved reference from payments collection for booking ${bookingId}`
            );
          }
        }

        if (!reference || String(reference).trim() === "") {
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
        error: subscriptionIdFromRequest
          ? "No payment reference found for this subscription. Complete or retry payment first."
          : "reference, bookingId, or subscriptionId is required, or no stored reference was found.",
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

    // Resolve bookingId: from request body, Paystack metadata, or our payments doc (fallback for MoMo when Paystack doesn't echo metadata)
    let resolvedBookingId: string | undefined =
      bookingId || (paystackData.metadata?.bookingId as string | undefined);
    if (isPaid && !resolvedBookingId && reference) {
      try {
        const firestore = getFirestore();
        const paymentSnap = await firestore.collection(PAYMENTS_COLLECTION).doc(reference).get();
        if (paymentSnap.exists) {
          const paymentData = paymentSnap.data();
          const fromPayment = paymentData?.bookingId;
          if (typeof fromPayment === "string" && fromPayment.trim()) {
            resolvedBookingId = fromPayment.trim();
            console.log(`[Verify] Resolved bookingId from payments doc: ${resolvedBookingId}`);
          }
        }
      } catch (lookupErr) {
        console.error("[Verify] Failed to resolve bookingId from payments doc:", lookupErr);
      }
    }

    // When payment succeeded, ensure booking is marked paid and job exists (in case webhook didn't run)
    if (isPaid && resolvedBookingId) {
      try {
        const firestore = getFirestore();
        const booking = await getBookingById(resolvedBookingId);
        if (booking) {
          const paidRef =
            typeof paystackData.reference === "string" && paystackData.reference.trim() !== ""
              ? paystackData.reference.trim()
              : typeof reference === "string"
                ? reference.trim()
                : "";
          await firestore
            .collection("bookings")
            .doc(resolvedBookingId)
            .set(
              {
                payment: {
                  status: "paid",
                  ...(paidRef ? { reference: paidRef } : {}),
                  paidAt: FieldValue.serverTimestamp(),
                },
              },
              { merge: true }
            );

          const existingJob = await firestore
            .collection(JOBS_COLLECTION)
            .where("bookingId", "==", resolvedBookingId)
            .limit(1)
            .get();
          const bookingType = (booking as { type?: string }).type;
          if (existingJob.empty && bookingType !== "subscription") {
            const items: JobItemSnapshot[] = Array.isArray(booking.items)
              ? (booking.items as any[]).map((i: any, idx: number) => ({
                  id:
                    i?.id ??
                    (i?.type
                      ? String(i.type).replace(/\s+/g, "_").toUpperCase()
                      : `ITEM_${idx}`),
                  type: String(i?.type ?? ""),
                  quantity: Number(i?.quantity) ?? 0,
                  unitPrice: Number(i?.unitPrice) ?? 0,
                  totalPrice: Number(i?.totalPrice) ?? 0,
                })).filter((i) => i.type)
              : [];
            const loc =
              (booking as any).location != null ? String((booking as any).location) : "";
            const meta =
              (booking as any).metadata && typeof (booking as any).metadata === "object"
                ? (booking as any).metadata
                : {};
            const addressSnapshot: JobAddressSnapshot = {
              addressLine1:
                meta?.addressLine1 ?? (booking as any).addressLine1 ?? loc ?? "",
              area: meta?.area ?? (booking as any).area ?? "",
              phoneNumber: meta?.phoneNumber ?? (booking as any).phoneNumber ?? "",
            };
            const bookingDate = (booking as any).date;
            const scheduledDate = bookingDate
              ? (typeof bookingDate === "string"
                  ? new Date(bookingDate)
                  : toDate(bookingDate) ?? new Date())
              : new Date();
            const Timestamp = firestore.Timestamp;
            await createJobForOneTimeBooking(firestore, {
              bookingId: resolvedBookingId,
              userId: booking.userId,
              scheduledDate,
              items,
              location: loc,
              addressSnapshot,
              windowId: (booking as any).windowId ?? "morning",
              windowLabel: (booking as any).windowLabel ?? "",
              Timestamp: Timestamp as any,
            });
            console.log(`[Verify] Job created for one-time booking ${resolvedBookingId}`);
          }
        }
      } catch (err) {
        console.error("[Verify] Failed to ensure booking paid or create job:", err);
        // Do not fail the verify response - payment is still successful
      }
    }

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

    // Otherwise return full format for direct reference verification (e.g. callback with ?reference=)
    const metadata = paystackData.metadata && typeof paystackData.metadata === "object"
      ? { ...paystackData.metadata }
      : {};
    if (resolvedBookingId) {
      metadata.bookingId = resolvedBookingId;
      if (paystackData.metadata?.userId) metadata.userId = paystackData.metadata.userId;
    }
    return res.status(200).json({
      status,
      reference: paystackData.reference,
      amount: paystackData.amount, // convert from smallest unit (kobo)
      currency: paystackData.currency,
      statusMessage: paystackData.gateway_response,
      metadata,
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

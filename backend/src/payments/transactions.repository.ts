import { firestore, FieldValue } from "../config/firebaseAdmin";
import type { TransactionRecord, TransactionStatus } from "./paystack.types";

const COLLECTION = "transactions";

/**
 * Upsert a transaction by reference.
 * Uses the reference as the document ID to ensure idempotency.
 */
export async function upsertTransactionFromPaystack(
  paystackData: any,
  preferredStatus?: TransactionStatus
): Promise<void> {
  const data = paystackData?.data;
  if (!data) return;

  const reference: string = data.reference;
  const amountKobo: number = data.amount;
  const amount = amountKobo / 100; // convert from kobo
  const currency: string = data.currency;
  const metadata: Record<string, any> | undefined = data.metadata;

  const docRef = firestore.collection(COLLECTION).doc(reference);
  const snapshot = await docRef.get();
  const existing = snapshot.exists ? (snapshot.data() as any) : null;

  const status: TransactionStatus =
    preferredStatus ??
    (data.status as TransactionStatus | undefined) ??
    "pending";

  // Idempotency: if we already have success, don't downgrade it.
  if (existing && existing.status === "success" && status !== "success") {
    return;
  }

  const record: Omit<TransactionRecord, "createdAt" | "updatedAt"> = {
    userId: metadata?.userId ?? existing?.userId ?? null,
    bookingId: metadata?.bookingId ?? existing?.bookingId ?? null,
    reference,
    amount,
    currency,
    status,
    rawPaystack: paystackData,
  };

  await docRef.set(
    {
      ...record,
      createdAt: existing?.createdAt ?? FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  // If payment was successful, mark the related booking as completed.
  if (status === "success" && metadata?.bookingId) {
    try {
      await firestore
        .collection("bookings")
        .doc(metadata.bookingId)
        .set({ status: "completed" }, { merge: true });
    } catch (err) {
      console.error(
        "Failed to update booking status for bookingId:",
        metadata.bookingId,
        err
      );
    }
  }
}



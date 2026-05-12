import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SUBSCRIPTIONS_COLLECTION } from "@/lib/constants";
import { setDocAtPath } from "@/lib/utils";
import type {
  Subscription,
  SubscriptionCollectionFrequency,
  SubscriptionInterval,
  SubscriptionStatus,
} from "@/types/subscription";

export type SaveSubscriptionRecordParams = {
  userId: string;
  reference: string;
  /** Optional; not used for simulated recurring */
  planCode?: string;
  status?: SubscriptionStatus;
  amount?: number;
  interval?: SubscriptionInterval;
  collectionFrequency?: SubscriptionCollectionFrequency;
  collectionDay?: string;
  startDate?: string;
  bookingId?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Save or update a subscription document in Firestore after backend create-subscription response.
 * Use status "pending" only; do not set "active" in app (webhook updates it).
 */
export async function saveSubscriptionRecord(
  params: SaveSubscriptionRecordParams
): Promise<string> {
  const subscriptionsRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const newDocRef = doc(subscriptionsRef);
  const subscriptionId = newDocRef.id;

  await setDocAtPath(
    [SUBSCRIPTIONS_COLLECTION, subscriptionId],
    {
      userId: params.userId,
      reference: params.reference,
      ...(params.planCode != null ? { planCode: params.planCode } : {}),
      status: params.status ?? "pending",
      ...(params.amount != null ? { amount: params.amount } : {}),
      ...(params.interval ? { interval: params.interval } : {}),
      ...(params.collectionFrequency ? { collectionFrequency: params.collectionFrequency } : {}),
      ...(params.collectionDay != null && params.collectionDay !== ""
        ? { collectionDay: params.collectionDay }
        : {}),
      ...(params.startDate != null && params.startDate !== "" ? { startDate: params.startDate } : {}),
      ...(params.bookingId != null && params.bookingId !== "" ? { bookingId: params.bookingId } : {}),
      currentPaymentReference: params.reference,
      payment: { status: "initiated", reference: params.reference },
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    { merge: false, addTimestamps: true }
  );

  return subscriptionId;
}

/** Merge Paystack reference onto an existing subscription (matches server shape). */
export async function mergeSubscriptionPaymentReference(
  subscriptionId: string,
  reference: string
): Promise<void> {
  const id = String(subscriptionId).trim();
  if (!id || !reference.trim()) return;
  await setDocAtPath(
    [SUBSCRIPTIONS_COLLECTION, id],
    {
      reference,
      currentPaymentReference: reference,
      payment: { status: "initiated", reference },
      updatedAt: serverTimestamp(),
    },
    { merge: true, addTimestamps: false }
  );
}

const SUBSCRIPTIONS_LIMIT = 10;

/**
 * Subscribe to subscription documents where userId == currentUser.id.
 * Returns unsubscribe function.
 */
export function subscribeToUserSubscriptions(
  userId: string,
  onUpdate: (subscriptions: Subscription[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  const subscriptionsRef = collection(db, SUBSCRIPTIONS_COLLECTION);
  const q = query(
    subscriptionsRef,
    where("userId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(SUBSCRIPTIONS_LIMIT)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const subscriptions: Subscription[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as Record<string, unknown>;
        const payment = data.payment as Subscription["payment"] | undefined;
        const collectionFrequency = data.collectionFrequency as Subscription["collectionFrequency"];
        const collectionDayRaw = data.collectionDay as string | undefined;
        const collectionDayOfWeekRaw = data.collectionDayOfWeek as string | undefined;
        const dayKey = (collectionDayOfWeekRaw || collectionDayRaw || "").trim();
        const refPay = typeof payment?.reference === "string" ? payment.reference.trim() : "";
        const refLast =
          typeof data.lastPaymentReference === "string" ? data.lastPaymentReference.trim() : "";
        const refCurrent =
          typeof data.currentPaymentReference === "string" ? data.currentPaymentReference.trim() : "";
        const refDirect = typeof data.reference === "string" ? data.reference.trim() : "";
        const refStr = refPay || refLast || refCurrent || refDirect || "";
        return {
          id: docSnap.id,
          userId: (data.userId as string) ?? "",
          email: data.email as string | undefined,
          reference: refStr,
          lastPaymentReference:
            typeof data.lastPaymentReference === "string" ? data.lastPaymentReference : undefined,
          currentPaymentReference:
            typeof data.currentPaymentReference === "string"
              ? data.currentPaymentReference
              : undefined,
          planCode: (data.planCode as string) ?? undefined,
          status: ((data.status as SubscriptionStatus) ?? "pending") as SubscriptionStatus,
          amount: data.amount as number | undefined,
          collectionFrequency,
          collectionDay: collectionDayRaw,
          startDate: typeof data.startDate === "string" ? data.startDate : undefined,
          interval: data.interval as Subscription["interval"],
          collectionDayOfWeek: dayKey || undefined,
          bookingId: typeof data.bookingId === "string" ? data.bookingId : undefined,
          nextChargeDate: (data.nextChargeDate ?? data.nextBillingDate) as Subscription["nextChargeDate"] ?? null,
          lastChargeDate: (data.lastChargeDate as Subscription["lastChargeDate"]) ?? null,
          payment: payment
            ? {
                status: payment.status ?? "none",
                reference:
                  payment.reference ??
                  (typeof data.lastPaymentReference === "string"
                    ? data.lastPaymentReference
                    : undefined) ??
                  (typeof data.reference === "string" ? data.reference : undefined) ??
                  (typeof data.currentPaymentReference === "string"
                    ? data.currentPaymentReference
                    : undefined),
              }
            : refStr
              ? { status: "initiated" as const, reference: refStr }
              : undefined,
          metadata: data.metadata as Record<string, unknown> | undefined,
          createdAt: (data.createdAt as Subscription["createdAt"]) ?? null,
          updatedAt: (data.updatedAt as Subscription["updatedAt"]) ?? null,
        };
      });
      onUpdate(subscriptions);
    },
    (err) => {
      console.error("[SubscriptionService] Snapshot error:", err);
      onError?.(err as Error);
    }
  );
}

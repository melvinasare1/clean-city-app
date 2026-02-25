import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { SUBSCRIPTIONS_COLLECTION } from "@/lib/constants";
import { setDocAtPath } from "@/lib/utils";
import type { Subscription, SubscriptionInterval, SubscriptionStatus } from "@/types/subscription";

export type SaveSubscriptionRecordParams = {
  userId: string;
  reference: string;
  /** Optional; not used for simulated recurring */
  planCode?: string;
  status?: SubscriptionStatus;
  amount?: number;
  interval?: SubscriptionInterval;
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
      ...(params.metadata ? { metadata: params.metadata } : {}),
    },
    { merge: false, addTimestamps: true }
  );

  return subscriptionId;
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
        const payment = data.payment as Subscription["payment"];
        return {
          id: docSnap.id,
          userId: (data.userId as string) ?? "",
          email: data.email as string | undefined,
          reference: (data.reference as string) ?? "",
          planCode: (data.planCode as string) ?? undefined,
          status: ((data.status as SubscriptionStatus) ?? "pending") as SubscriptionStatus,
          amount: data.amount as number | undefined,
          interval: data.interval as Subscription["interval"],
          collectionDayOfWeek: data.collectionDayOfWeek as string | undefined,
          nextChargeDate: (data.nextChargeDate ?? data.nextBillingDate) as Subscription["nextChargeDate"] ?? null,
          lastChargeDate: (data.lastChargeDate as Subscription["lastChargeDate"]) ?? null,
          payment: payment
            ? { status: payment.status ?? "none", reference: payment.reference }
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

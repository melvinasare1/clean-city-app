// src/services/referralService.ts
//
// Referral creation + reward logic.
// Uses Firestore transactions to ensure one-time, race-safe rewards.

import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  runTransaction,
  serverTimestamp,
  type Firestore,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocAtPath, PROFILES_COLLECTION } from "@/lib/utils";

const REFERRALS_COLLECTION = "referrals";

export type ReferralStatus = "pending" | "completed";

export interface ReferralDocument {
  referrerUserId: string;
  referrerReferralCode: string;
  referredUserId: string;
  referredEmail?: string;
  status: ReferralStatus;
  rewardAmount: number;
  createdAt: any; // Firestore Timestamp
  completedAt?: any; // Firestore Timestamp
}

export type ReferralDoc = ReferralDocument & { id: string };

export interface ProfileReferralData {
  referralCode: string | null;
  creditBalance: number;
}

const DEFAULT_REFERRAL_REWARD_AMOUNT = 20; // Reward per successful referral (in app currency units)

/**
 * Look up a referrer by referralCode and, if valid,
 * create referrals/{newUserId} with status "pending".
 *
 * - Does nothing if referralCode is falsy or no matching referrer is found.
 */
export async function createReferralIfValid(params: {
  newUserId: string;
  newUserEmail: string;
  referralCode?: string | null;
  rewardAmount?: number;
}): Promise<void> {
  const { newUserId, newUserEmail, referralCode, rewardAmount } = params;

  const trimmedCode = referralCode?.trim();
  if (!trimmedCode) {
    return;
  }

  const reward = rewardAmount ?? DEFAULT_REFERRAL_REWARD_AMOUNT;

  // Find referrer profile by referralCode
  const profilesRef = collection(db, PROFILES_COLLECTION);
  const q = query(
    profilesRef,
    where("referralCode", "==", trimmedCode),
    limit(1)
  );
  const snap = await getDocs(q);

  if (snap.empty) {
    // Invalid code: do not create referral; user profile may still store referredBy=code.
    return;
  }

  const referrerDoc = snap.docs[0];
  const referrerUserId = referrerDoc.id;

  const referralPayload: Omit<ReferralDocument, "createdAt" | "completedAt"> & {
    createdAt: any;
  } = {
    referrerUserId,
    referrerReferralCode: trimmedCode,
    referredUserId: newUserId,
    referredEmail: newUserEmail,
    status: "pending",
    rewardAmount: reward,
    createdAt: serverTimestamp(),
  };

  await setDocAtPath(
    [REFERRALS_COLLECTION, newUserId],
    referralPayload,
    {
      merge: false,
      addTimestamps: false,
    }
  );
}

/**
 * Reward a referral if all eligibility conditions are met.
 *
 * This function:
 * - Runs inside a Firestore transaction
 * - Reads profiles/{referredUserId} and referrals/{referredUserId}
 * - Checks:
 *   - User was referred (referredBy not null/empty)
 *   - referralRewarded === false
 *   - Referral status === "pending"
 * - If valid:
 *   - Adds rewardAmount to referrer's creditBalance
 *   - Marks referral as "completed" with completedAt timestamp
 *   - Sets referralRewarded = true on referred user's profile
 *
 * Safe to call multiple times; only the first eligible call will perform writes.
 */
export async function rewardReferralIfEligible(
  referredUserId: string,
  options?: { firestore?: Firestore }
): Promise<void> {
  const firestore: Firestore = options?.firestore ?? db;

  const referredProfileRef: DocumentReference = doc(
    firestore,
    PROFILES_COLLECTION,
    referredUserId
  );
  const referralRef: DocumentReference = doc(
    firestore,
    REFERRALS_COLLECTION,
    referredUserId
  );

  await runTransaction(firestore, async (tx) => {
    const referredSnap = await tx.get(referredProfileRef);
    const referralSnap = await tx.get(referralRef);

    if (!referredSnap.exists() || !referralSnap.exists()) {
      // Either user profile or referral record missing – nothing to reward.
      return;
    }

    const referredData = referredSnap.data() as {
      referredBy?: string | null;
      referralRewarded?: boolean;
    };
    const referralData = referralSnap.data() as {
      referrerUserId: string;
      rewardAmount: number;
      status: ReferralStatus;
    };

    const wasReferred = !!referredData.referredBy;
    const alreadyRewarded = referredData.referralRewarded === true;
    const isPending = referralData.status === "pending";

    if (!wasReferred || alreadyRewarded || !isPending) {
      // Not eligible for reward – exit without writes.
      return;
    }

    const referrerUserId = referralData.referrerUserId;
    const rewardAmount = referralData.rewardAmount ?? 0;
    if (!referrerUserId || rewardAmount <= 0) {
      return;
    }

    const referrerProfileRef: DocumentReference = doc(
      firestore,
      PROFILES_COLLECTION,
      referrerUserId
    );
    const referrerSnap = await tx.get(referrerProfileRef);
    const referrerData = (referrerSnap.exists()
      ? referrerSnap.data()
      : {}) as { creditBalance?: number };

    const currentBalance = referrerData.creditBalance ?? 0;
    const newBalance = currentBalance + rewardAmount;

    // Update referrer's credit balance (create doc if needed)
    tx.set(
      referrerProfileRef,
      { creditBalance: newBalance },
      { merge: true }
    );

    // Mark referral as completed
    tx.update(referralRef, {
      status: "completed",
      completedAt: serverTimestamp(),
    });

    // Mark referred user's profile as rewarded
    tx.update(referredProfileRef, {
      referralRewarded: true,
    });
  });
}

/**
 * Subscribe to the current user's profile for referral-related fields.
 *
 * The callback receives `{ referralCode, creditBalance }`.
 * If the document is missing, `referralCode` will be `null` and `creditBalance` will be `0`.
 */
export function listenToProfile(
  uid: string,
  onData: (profile: ProfileReferralData) => void,
  onError?: (error: Error) => void
): () => void {
  const profileRef = doc(db, PROFILES_COLLECTION, uid);

  const unsubscribe = onSnapshot(
    profileRef,
    (snapshot) => {
      const raw = snapshot.exists() ? (snapshot.data() as any) : {};
      const referralCode: string | null =
        typeof raw.referralCode === "string" ? raw.referralCode : null;
      const creditBalance: number =
        typeof raw.creditBalance === "number" ? raw.creditBalance : 0;

      onData({ referralCode, creditBalance });
    },
    (error) => {
      console.error("Error listening to profile referrals:", error);
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}

/**
 * Subscribe to referrals where the given user is the referrer.
 *
 * The callback receives an array of `ReferralDoc`.
 */
export function listenToReferralsAsReferrer(
  uid: string,
  onData: (referrals: ReferralDoc[]) => void,
  onError?: (error: Error) => void
): () => void {
  const referralsRef = collection(db, REFERRALS_COLLECTION);
  const q = query(referralsRef, where("referrerUserId", "==", uid));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const referrals: ReferralDoc[] = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() as ReferralDocument;
        return {
          id: docSnap.id,
          ...data,
        };
      });
      onData(referrals);
    },
    (error) => {
      console.error("Error listening to referrals as referrer:", error);
      if (onError) {
        onError(error as Error);
      }
    }
  );

  return unsubscribe;
}


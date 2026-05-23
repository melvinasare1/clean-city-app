/**
 * POST /api/referrals/apply
 * Body: { code: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from '../lib/firebase-admin';
import { admin, getFirestore } from '../lib/firebase-admin';
import { PROFILES_COLLECTION } from '../lib/collections';
import { parseRequestBody } from '../lib/parse-request-body';
import { verifyAuthHeader } from '../lib/verify-auth';

const REFERRALS_COLLECTION = 'referrals';
const REFERRAL_WINDOW_HOURS = 48;
const DEFAULT_REWARD_AMOUNT = 20;
const CODE_PATTERN = /^[A-Z0-9-]{6,15}$/;

function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!code || !CODE_PATTERN.test(code)) return null;
  return code;
}

function toMillis(value: unknown): number | null {
  if (!value) return null;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(value);
  }
  return null;
}

function expectedReferralCodeForUid(uid: string): string {
  return `CC-${uid.slice(0, 6).toUpperCase()}`;
}

async function getSignupMs(
  profile: Record<string, unknown>,
  uid: string
): Promise<number | null> {
  const fromProfile = toMillis(profile.createdAt);
  if (fromProfile) return fromProfile;

  try {
    const authUser = await admin.auth().getUser(uid);
    if (authUser.metadata.creationTime) {
      return new Date(authUser.metadata.creationTime).getTime();
    }
  } catch {
    // ignore
  }

  return null;
}

async function findReferrerByCode(
  firestore: admin.firestore.Firestore,
  code: string
): Promise<admin.firestore.QueryDocumentSnapshot | null> {
  const byField = await firestore
    .collection(PROFILES_COLLECTION)
    .where('referralCode', '==', code)
    .limit(1)
    .get();

  if (!byField.empty) {
    return byField.docs[0];
  }

  // Legacy profiles may only use the generated CC-{uidPrefix} format without referralCode stored
  if (!code.startsWith('CC-')) {
    return null;
  }

  const uidPrefix = code.slice(3).toUpperCase();
  if (uidPrefix.length < 4 || uidPrefix.length > 8) {
    return null;
  }

  const snapshot = await firestore.collection(PROFILES_COLLECTION).limit(500).get();
  const match = snapshot.docs.find(
    (docSnap) => docSnap.id.slice(0, uidPrefix.length).toUpperCase() === uidPrefix
  );

  return match ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  if (!admin.apps.length) {
    console.error('[referrals/apply] Firebase Admin not initialized');
    return res.status(503).json({ success: false, error: 'server_error' });
  }

  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const body = parseRequestBody(req);
    const code = normalizeCode(body.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'invalid_code' });
    }

    const firestore = getFirestore();
    const profileRef = firestore.collection(PROFILES_COLLECTION).doc(uid);
    let profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      let email: string | null = null;
      try {
        const authUser = await admin.auth().getUser(uid);
        email = authUser.email ?? null;
      } catch {
        // ignore
      }

      const referralCode = expectedReferralCodeForUid(uid);
      await profileRef.set(
        {
          email,
          referralCode,
          referredBy: null,
          referralCodeApplied: false,
          creditBalance: 0,
          referralRewarded: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
      profileSnap = await profileRef.get();
    }

    const profile = profileSnap.data() ?? {};
    const signupMs = await getSignupMs(profile, uid);
    const now = Date.now();

    if (profile.referralCodeApplied === true) {
      return res.status(400).json({ success: false, error: 'already_used' });
    }

    if (profile.firstBookingAt) {
      return res.status(400).json({ success: false, error: 'window_closed' });
    }

    if (!signupMs || now - signupMs >= REFERRAL_WINDOW_HOURS * 60 * 60 * 1000) {
      return res.status(400).json({ success: false, error: 'window_closed' });
    }

    const ownCode =
      typeof profile.referralCode === 'string'
        ? profile.referralCode
        : expectedReferralCodeForUid(uid);

    if (ownCode === code) {
      return res.status(400).json({ success: false, error: 'self_referral' });
    }

    const referrerDoc = await findReferrerByCode(firestore, code);

    if (!referrerDoc) {
      return res.status(400).json({ success: false, error: 'invalid_code' });
    }

    const referrerId = referrerDoc.id;

    if (referrerId === uid) {
      return res.status(400).json({ success: false, error: 'self_referral' });
    }

    const referrerData = referrerDoc.data();

    // Ensure referrer has referralCode indexed for future lookups
    if (referrerData?.referralCode !== code) {
      await referrerDoc.ref.set({ referralCode: code }, { merge: true });
    }

    if (referrerData?.banned === true || referrerData?.suspended === true) {
      return res.status(400).json({ success: false, error: 'invalid_code' });
    }

    const referralRef = firestore.collection(REFERRALS_COLLECTION).doc(uid);
    const existingReferral = await referralRef.get();
    if (existingReferral.exists) {
      return res.status(400).json({ success: false, error: 'already_used' });
    }

    await firestore.runTransaction(async (tx) => {
      const freshProfile = await tx.get(profileRef);
      const data = freshProfile.data() ?? {};

      if (data.referralCodeApplied === true || data.referredBy) {
        throw new Error('already_used');
      }
      if (data.firstBookingAt) {
        throw new Error('window_closed');
      }

      tx.set(
        referralRef,
        {
          referrerUserId: referrerId,
          referrerReferralCode: code,
          referredUserId: uid,
          referredEmail: data.email ?? null,
          status: 'pending',
          rewardAmount: DEFAULT_REWARD_AMOUNT,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false }
      );

      tx.set(
        profileRef,
        {
          referredBy: code,
          referralCodeUsed: code,
          referralCodeApplied: true,
          referralDiscount: {
            type: 'percent',
            value: 10,
            appliesTo: 'first_booking',
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    return res.status(200).json({
      success: true,
      discount: {
        type: 'percent',
        value: 10,
        appliesTo: 'first_booking',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'already_used') {
      return res.status(400).json({ success: false, error: 'already_used' });
    }
    if (message === 'window_closed') {
      return res.status(400).json({ success: false, error: 'window_closed' });
    }

    console.error('[referrals/apply] error:', error);
    return res.status(500).json({ success: false, error: 'server_error' });
  }
}

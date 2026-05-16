/**
 * POST /api/referrals/apply
 * Body: { code: string }
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { FieldValue } from '../lib/firebase-admin';
import { getFirestore } from '../lib/firebase-admin';
import { PROFILES_COLLECTION } from '../lib/collections';
import { verifyAuthHeader } from '../lib/verify-auth';

const REFERRALS_COLLECTION = 'referrals';
const REFERRAL_WINDOW_HOURS = 48;
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
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'object' && value !== null && 'toMillis' in value) {
    const fn = (value as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') return fn.call(value);
  }
  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return res.status(401).json({ success: false, error: 'unauthorized' });
    }

    const body = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const code = normalizeCode(body.code);
    if (!code) {
      return res.status(400).json({ success: false, error: 'invalid_code' });
    }

    const firestore = getFirestore();
    const profileRef = firestore.collection(PROFILES_COLLECTION).doc(uid);
    const profileSnap = await profileRef.get();

    if (!profileSnap.exists) {
      return res.status(404).json({ success: false, error: 'profile_not_found' });
    }

    const profile = profileSnap.data() ?? {};
    const signupMs = toMillis(profile.createdAt);
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

    if (profile.referralCode === code) {
      return res.status(400).json({ success: false, error: 'self_referral' });
    }

    const referrerQuery = await firestore
      .collection(PROFILES_COLLECTION)
      .where('referralCode', '==', code)
      .limit(1)
      .get();

    if (referrerQuery.empty) {
      return res.status(400).json({ success: false, error: 'invalid_code' });
    }

    const referrerDoc = referrerQuery.docs[0];
    const referrerId = referrerDoc.id;

    if (referrerId === uid) {
      return res.status(400).json({ success: false, error: 'self_referral' });
    }

    const referrerData = referrerDoc.data();
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
          rewardAmount: 0,
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

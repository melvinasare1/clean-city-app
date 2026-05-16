/**
 * GET /api/referrals/stats
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getFirestore } from '../lib/firebase-admin';
import { PROFILES_COLLECTION } from '../lib/collections';
import { verifyAuthHeader } from '../lib/verify-auth';

const REFERRALS_COLLECTION = 'referrals';
const FREE_PICKUP_THRESHOLD = 3;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  try {
    const uid = await verifyAuthHeader(req);
    if (!uid) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const firestore = getFirestore();
    const profileSnap = await firestore.collection(PROFILES_COLLECTION).doc(uid).get();
    const profile = profileSnap.data() ?? {};

    const code =
      typeof profile.referralCode === 'string'
        ? profile.referralCode
        : `CC-${uid.slice(0, 6).toUpperCase()}`;

    const referralsSnap = await firestore
      .collection(REFERRALS_COLLECTION)
      .where('referrerUserId', '==', uid)
      .where('status', '==', 'completed')
      .get();

    const friendsReferred = referralsSnap.size;
    const freePickupsEarned = Math.floor(friendsReferred / FREE_PICKUP_THRESHOLD);

    return res.status(200).json({
      code,
      friendsReferred,
      freePickupsEarned,
      freePickupThreshold: FREE_PICKUP_THRESHOLD,
    });
  } catch (error) {
    console.error('[referrals/stats] error:', error);
    return res.status(500).json({ error: 'server_error' });
  }
}

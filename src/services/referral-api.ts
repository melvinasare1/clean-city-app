import { auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';
import type {
  ApplyReferralCodeResponse,
  ReferralStatsResponse,
} from '@/types/referral';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('You must be signed in to continue.');
  }

  const token = await currentUser.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function applyReferralCode(
  code: string
): Promise<ApplyReferralCodeResponse> {
  const base = getApiBaseUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${base}/api/referrals/apply`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ code }),
  });

  const json = (await response.json()) as ApplyReferralCodeResponse;
  return json;
}

export async function getReferralStats(): Promise<ReferralStatsResponse> {
  const base = getApiBaseUrl();
  const headers = await getAuthHeaders();

  const response = await fetch(`${base}/api/referrals/stats`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error('Failed to load referral stats.');
  }

  return (await response.json()) as ReferralStatsResponse;
}

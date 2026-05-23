import { auth } from '@/lib/firebase';
import { getApiBaseUrl } from '@/lib/apiBase';
import { applyReferralCodeLocally } from '@/services/referralService';
import type {
  ApplyReferralCodeResponse,
  ReferralApplyErrorCode,
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

function parseApplyResponse(
  status: number,
  json: Record<string, unknown>
): ApplyReferralCodeResponse {
  if (json.success === true) {
    return json as ApplyReferralCodeResponse;
  }

  const error =
    typeof json.error === 'string'
      ? (json.error as ReferralApplyErrorCode)
      : status === 401
        ? 'unauthorized'
        : status >= 500
          ? 'server_error'
          : undefined;

  return {
    success: false,
    error,
  };
}

function shouldUseLocalApplyFallback(status: number): boolean {
  return status === 404 || status === 405;
}

export async function applyReferralCode(
  code: string
): Promise<ApplyReferralCodeResponse> {
  const base = getApiBaseUrl();
  const headers = await getAuthHeaders();

  let response: Response;
  try {
    response = await fetch(`${base}/api/referrals/apply`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
  } catch (error) {
    console.error('[applyReferralCode] network error:', error);
    return applyReferralCodeLocally(code);
  }

  if (shouldUseLocalApplyFallback(response.status)) {
    if (__DEV__) {
      console.warn(
        '[applyReferralCode] API route not deployed (',
        response.status,
        '), using Firestore fallback'
      );
    }
    return applyReferralCodeLocally(code);
  }

  const responseText = await response.text();
  let json: Record<string, unknown>;
  try {
    json = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
  } catch (error) {
    console.error(
      '[applyReferralCode] invalid JSON:',
      response.status,
      responseText.slice(0, 120),
      error
    );
    if (shouldUseLocalApplyFallback(response.status)) {
      return applyReferralCodeLocally(code);
    }
    return { success: false, error: 'server_error' };
  }

  if (__DEV__) {
    console.log('[applyReferralCode]', response.status, json);
  }

  return parseApplyResponse(response.status, json);
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

import * as Crypto from 'expo-crypto';
import type { AuthSessionResult } from 'expo-auth-session';

/**
 * After Google OAuth, the ID token may appear on `params` (implicit / merged)
 * or on `authentication` (authorization code exchange). Both must be checked for Firebase.
 */
export function extractGoogleIdToken(response: AuthSessionResult | null): string | null {
    if (!response || response.type !== 'success') return null;
    const fromParams = response.params?.id_token;
    if (typeof fromParams === 'string' && fromParams.length > 0) return fromParams;
    const fromAuth = response.authentication?.idToken;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    return null;
}

export function extractGoogleAccessToken(response: AuthSessionResult | null): string | null {
    if (!response || response.type !== 'success') return null;
    const fromAuth = response.authentication?.accessToken;
    if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;
    const fromParams = response.params?.access_token;
    if (typeof fromParams === 'string' && fromParams.length > 0) return fromParams;
    return null;
}

export const generateNonce = async (): Promise<string> => {
    const randomBytes = await Crypto.getRandomBytesAsync(32);
    return Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
};

export const sha256 = async (input: string): Promise<string> => {
    return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, input);
};

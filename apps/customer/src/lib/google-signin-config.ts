import { Platform } from 'react-native';

let configured = false;

/**
 * Must run before any Google Sign-In call. `webClientId` must be the OAuth **Web** client ID from
 * the same Firebase/Google Cloud project so the returned ID token `aud` matches Firebase Auth.
 * On native, the Google Sign-In SDK uses the iOS/Android OAuth clients from Firebase config files;
 * `webClientId` is still required so the ID token audience is the web client (Firebase expectation).
 * Must match the Web client in `firebase/google-services.json` / `GoogleService-Info.plist` (see eas.json).
 */
export function ensureGoogleSignInConfigured(): void {
    if (Platform.OS === 'web') return;
    if (configured) return;
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) {
        console.warn('[GoogleSignIn] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not set');
        return;
    }
    // Keep native module off the web bundle path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId });
    configured = true;
}

import { Platform } from 'react-native';

/** Clears the Google session so the next sign-in can pick a different account. */
export async function signOutGoogleSession(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { GoogleSignin } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
        await GoogleSignin.signOut();
    } catch {
        // No Google session — ignore
    }
}

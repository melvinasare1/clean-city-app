import React from 'react';
import { TouchableOpacity, Alert, Platform } from 'react-native';
import {
    GoogleSignin,
    statusCodes,
    type SignInResponse,
} from '@react-native-google-signin/google-signin';
import { GoogleAuthProvider } from 'firebase/auth';
import { trackEvent } from '@/services/analytics';
import { ensureGoogleSignInConfigured } from '@/lib/google-signin-config';
import { SocialButtonLabel } from './social-button-label';
import type { GoogleAuthButtonProps } from './google-auth-button.types';

export function GoogleAuthButton({
    disabled,
    onGoogleCredential,
    screen,
    style,
    textStyle,
}: GoogleAuthButtonProps) {
    const alertTitle = screen === 'login' ? 'Google Sign In Failed' : 'Google Sign Up Failed';

    const handlePress = async () => {
        try {
            ensureGoogleSignInConfigured();
            if (Platform.OS === 'android') {
                await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            }
            const result = (await GoogleSignin.signIn()) as SignInResponse;
            if (result.type !== 'success') return;

            let idToken = result.data.idToken;
            const tokens = await GoogleSignin.getTokens();
            if (!idToken) idToken = tokens.idToken;
            const accessToken = tokens.accessToken;

            if (!idToken) {
                throw new Error(
                    'Google sign-in did not return an ID token. Check Web client ID in Firebase and EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID.'
                );
            }

            const credential = accessToken
                ? GoogleAuthProvider.credential(idToken, accessToken)
                : GoogleAuthProvider.credential(idToken);

            await onGoogleCredential(credential);
        } catch (error: unknown) {
            const err = error as { code?: string; message?: string };
            if (err.code === statusCodes.SIGN_IN_CANCELLED) return;
            await trackEvent('auth_error', { screen, reason: 'google_native_error' });
            Alert.alert(alertTitle, err.message || 'Could not complete Google sign-in');
        }
    };

    return (
        <TouchableOpacity style={style} onPress={handlePress} disabled={disabled}>
            <SocialButtonLabel provider="google" label="Continue with Google" textStyle={textStyle} />
        </TouchableOpacity>
    );
}

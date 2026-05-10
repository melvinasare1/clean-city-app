import React, { useCallback, useEffect, useRef } from 'react';
import { TouchableOpacity, Alert } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleAuthProvider } from 'firebase/auth';
import { AppText } from '@/components';
import { trackEvent } from '@/services/analytics';
import {
    extractGoogleIdToken,
    extractGoogleAccessToken,
    googleWebAuthRequestConfig,
} from '@/lib/social-auth';
import type { GoogleAuthButtonProps } from './google-auth-button.types';

export function GoogleAuthButton({
    disabled,
    onGoogleCredential,
    screen,
    style,
    textStyle,
}: GoogleAuthButtonProps) {
    const alertTitle = screen === 'login' ? 'Google Sign In Failed' : 'Google Sign Up Failed';

    const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest(googleWebAuthRequestConfig);

    const lastGoogleIdToken = useRef<string | null>(null);

    const completeWithResponse = useCallback(
        async (idToken: string, accessToken: string | null) => {
            const credential = accessToken
                ? GoogleAuthProvider.credential(idToken, accessToken)
                : GoogleAuthProvider.credential(idToken);
            await onGoogleCredential(credential);
        },
        [onGoogleCredential]
    );

    useEffect(() => {
        if (!googleResponse) return;

        if (googleResponse.type === 'error') {
            const msg =
                googleResponse.params?.error_description ||
                googleResponse.params?.error ||
                googleResponse.error?.message ||
                'Google sign-in failed';
            void trackEvent('auth_error', { screen, reason: 'google_error' });
            Alert.alert(alertTitle, String(msg));
            return;
        }

        if (googleResponse.type !== 'success') return;

        const idToken = extractGoogleIdToken(googleResponse);
        if (!idToken) return;

        if (lastGoogleIdToken.current === idToken) return;
        lastGoogleIdToken.current = idToken;

        const accessToken = extractGoogleAccessToken(googleResponse);
        void completeWithResponse(idToken, accessToken);
    }, [googleResponse, screen, alertTitle, completeWithResponse]);

    const handlePress = async () => {
        try {
            const result = await promptGoogleAsync();
            if (result.type === 'cancel' || result.type === 'dismiss') return;
            if (result.type === 'error') {
                const msg =
                    result.params?.error_description ||
                    result.params?.error ||
                    result.error?.message ||
                    'Google sign-in failed';
                await trackEvent('auth_error', { screen, reason: 'google_error' });
                Alert.alert(alertTitle, String(msg));
            }
        } catch (e: unknown) {
            const err = e as { message?: string };
            await trackEvent('auth_error', { screen, reason: 'google_prompt_error' });
            Alert.alert(alertTitle, err?.message || 'Could not open Google sign-in');
        }
    };

    return (
        <TouchableOpacity style={style} onPress={handlePress} disabled={disabled}>
            <AppText style={textStyle}>Continue with Google</AppText>
        </TouchableOpacity>
    );
}

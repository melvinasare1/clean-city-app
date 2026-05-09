
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { styles } from './login-screen.styles';
import { AppText, AppTextInput } from '@/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreenProps } from '../types';
import { trackEvent } from '@/services/analytics';
import { registerForPushNotifications } from '@/services/notifications';
import {
    generateNonce,
    sha256,
    extractGoogleIdToken,
    extractGoogleAccessToken,
} from '@/lib/social-auth';

const SCREEN = 'login';

const getAuthErrorReason = (error: any): string => {
    const code = error?.code as string | undefined;
    const message = (error?.message as string | undefined)?.toLowerCase() ?? '';

    if (code) {
        if (
            code === 'auth/invalid-credential' ||
            code === 'auth/wrong-password' ||
            code === 'auth/user-not-found'
        ) {
            return 'invalid_credentials';
        }
        if (code === 'auth/network-request-failed') {
            return 'network_error';
        }
        if (code === 'auth/too-many-requests') {
            return 'timeout';
        }
    }

    if (message.includes('network')) {
        return 'network_error';
    }

    return 'unknown';
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login, loginWithCredential } = useAuth();

    const [, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
        iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
        androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
        webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    });

    const lastGoogleIdToken = useRef<string | null>(null);

    useEffect(() => {
        trackEvent('auth_screen_viewed', { screen: SCREEN });
    }, []);

    const handleSocialLogin = useCallback(
        async (credential: any, method: 'google' | 'apple') => {
            setIsLoading(true);
            try {
                await trackEvent('login_started', { screen: SCREEN, method });
                await loginWithCredential(credential);
                await registerForPushNotifications();
                await trackEvent('login_success', { screen: SCREEN, method });
            } catch (error: any) {
                const reason = getAuthErrorReason(error);
                await trackEvent('auth_error', { screen: SCREEN, reason });
                Alert.alert('Sign In Failed', error.message || 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        },
        [loginWithCredential]
    );

    useEffect(() => {
        if (!googleResponse) return;

        if (googleResponse.type === 'error') {
            const msg =
                googleResponse.params?.error_description ||
                googleResponse.params?.error ||
                googleResponse.error?.message ||
                'Google sign-in failed';
            void trackEvent('auth_error', { screen: SCREEN, reason: 'google_error' });
            Alert.alert('Google Sign In Failed', String(msg));
            return;
        }

        if (googleResponse.type !== 'success') return;

        const idToken = extractGoogleIdToken(googleResponse);
        if (!idToken) {
            // Native flow: code exchange fills `id_token` shortly after success — wait for next update.
            return;
        }

        if (lastGoogleIdToken.current === idToken) return;
        lastGoogleIdToken.current = idToken;

        const accessToken = extractGoogleAccessToken(googleResponse);
        const credential = accessToken
            ? GoogleAuthProvider.credential(idToken, accessToken)
            : GoogleAuthProvider.credential(idToken);

        void handleSocialLogin(credential, 'google');
    }, [googleResponse, handleSocialLogin]);

    const handleGoogleLogin = async () => {
        try {
            const result = await promptGoogleAsync();
            if (result.type === 'cancel' || result.type === 'dismiss') return;
            if (result.type === 'error') {
                const msg =
                    result.params?.error_description ||
                    result.params?.error ||
                    result.error?.message ||
                    'Google sign-in failed';
                await trackEvent('auth_error', { screen: SCREEN, reason: 'google_error' });
                Alert.alert('Google Sign In Failed', String(msg));
            }
        } catch (e: any) {
            await trackEvent('auth_error', { screen: SCREEN, reason: 'google_prompt_error' });
            Alert.alert('Google Sign In Failed', e?.message || 'Could not open Google sign-in');
        }
    };

    const handleAppleLogin = async () => {
        try {
            const nonce = await generateNonce();
            const hashedNonce = await sha256(nonce);

            const appleCredential = await AppleAuthentication.signInAsync({
                requestedScopes: [
                    AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
                    AppleAuthentication.AppleAuthenticationScope.EMAIL,
                ],
                nonce: hashedNonce,
            });

            if (!appleCredential.identityToken) {
                throw new Error('Apple sign-in failed: no identity token');
            }

            const provider = new OAuthProvider('apple.com');
            const credential = provider.credential({
                idToken: appleCredential.identityToken,
                rawNonce: nonce,
            });

            await handleSocialLogin(credential, 'apple');
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') return;
            await trackEvent('auth_error', { screen: SCREEN, reason: 'apple_error' });
            Alert.alert('Apple Sign In Failed', error.message || 'An error occurred');
        }
    };

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        await trackEvent('login_started', { screen: SCREEN, method: 'email_password' });

        setIsLoading(true);
        try {
            await login(email, password);
            await registerForPushNotifications();
            await trackEvent('login_success', { screen: SCREEN, method: 'email_password' });
        } catch (error: any) {
            const reason = getAuthErrorReason(error);
            await trackEvent('auth_error', { screen: SCREEN, reason });
            Alert.alert('Login Failed', error.message || 'An error occurred during login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigation.navigate('ForgotPassword');
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.contentContainer}>
                        <View style={styles.form}>
                            <AppText style={styles.title}>Clean City</AppText>
                            <AppText style={styles.subtitle}>Waste Management Made Easy</AppText>

                            <AppTextInput
                                style={styles.input}
                                placeholder="Email"
                                value={email}
                                onChangeText={setEmail}
                                keyboardType="email-address"
                                editable={!isLoading}
                            />

                            <AppTextInput
                                style={styles.input}
                                placeholder="Password"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                editable={!isLoading}
                            />

                            <TouchableOpacity
                                style={[styles.button, isLoading && styles.buttonDisabled]}
                                onPress={handleLogin}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <AppText style={styles.buttonText}>Login</AppText>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[isLoading && styles.buttonDisabled]}
                                onPress={handleForgotPassword}
                                disabled={isLoading}
                            >
                                <AppText style={styles.forgottenPassword}>
                                    Forgot password? Click here to reset
                                </AppText>
                            </TouchableOpacity>

                            <View style={styles.dividerRow}>
                                <View style={styles.dividerLine} />
                                <AppText style={styles.dividerText}>or continue with</AppText>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity
                                style={[styles.socialButton, isLoading && styles.buttonDisabled]}
                                onPress={handleGoogleLogin}
                                disabled={isLoading}
                            >
                                <AppText style={styles.socialButtonText}>Continue with Google</AppText>
                            </TouchableOpacity>

                            {Platform.OS === 'ios' && (
                                <TouchableOpacity
                                    style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
                                    onPress={handleAppleLogin}
                                    disabled={isLoading}
                                >
                                    <AppText style={[styles.socialButtonText, styles.appleButtonText]}>
                                        Continue with Apple
                                    </AppText>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <TouchableOpacity
                        style={styles.actionLink}
                        onPress={() => navigation.navigate('Signup')}
                        disabled={isLoading}
                    >
                        <AppText style={styles.linkText}>
                            Don't have an account?{' '}
                            <AppText style={styles.linkTextBold}>Sign Up</AppText>
                        </AppText>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

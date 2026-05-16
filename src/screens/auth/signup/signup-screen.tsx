
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, type AuthCredential } from 'firebase/auth';
import { styles } from './signup-screen.styles';
import { AppText, AppTextInput } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignupScreenProps } from '../types';
import { trackEvent } from '@/services/analytics';
import type { AppUserRole } from '@/contexts/auth-context';
import { generateNonce, sha256 } from '@/lib/social-auth';
import { GoogleAuthButton } from '../google-auth-button';
import { SocialButtonLabel } from '../social-button-label';

const SCREEN = 'signup';

/** Sign in with Apple is only available on iOS; Android shows Google only. */
const SHOW_APPLE_SIGN_IN = Platform.OS === 'ios';

const getSignupErrorReason = (error: any): string => {
    const code = error?.code as string | undefined;
    const message = (error?.message as string | undefined)?.toLowerCase() ?? '';

    if (code) {
        if (code === 'auth/email-already-in-use') return 'email_in_use';
        if (code === 'auth/weak-password') return 'weak_password';
        if (code === 'auth/invalid-email') return 'invalid_email';
        if (code === 'auth/network-request-failed') return 'network_error';
    }

    if (message.includes('network')) return 'network_error';

    return 'unknown';
};

const ROLE_OPTIONS: { value: AppUserRole; label: string }[] = [
    { value: 'customer', label: 'Sign up as Customer' },
    { value: 'driver', label: 'Sign up as Driver' },
];

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<AppUserRole>('customer');
    const [referralCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { signup, loginWithCredential } = useAuth();

    useEffect(() => {
        trackEvent('auth_screen_viewed', { screen: SCREEN });
    }, []);

    const handleSocialSignup = useCallback(
        async (credential: any, method: 'google' | 'apple') => {
            setIsLoading(true);
            try {
                await trackEvent('signup_started', { screen: SCREEN, method });
                await loginWithCredential(credential);
                await trackEvent('signup_completed', { screen: SCREEN, method });
            } catch (error: any) {
                const reason = getSignupErrorReason(error);
                await trackEvent('auth_error', { screen: SCREEN, reason });
                Alert.alert('Sign Up Failed', error.message || 'An error occurred');
            } finally {
                setIsLoading(false);
            }
        },
        [loginWithCredential]
    );

    const handleAppleSignup = async () => {
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

            await handleSocialSignup(credential, 'apple');
        } catch (error: any) {
            if (error.code === 'ERR_REQUEST_CANCELED') return;
            await trackEvent('auth_error', { screen: SCREEN, reason: 'apple_error' });
            Alert.alert('Apple Sign Up Failed', error.message || 'An error occurred');
        }
    };

    const handleSignup = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);

        try {
            await trackEvent('signup_started', { screen: SCREEN, method: 'email_password' });
            await signup(email, password, role, referralCode ?? undefined);
            await trackEvent('signup_completed', { screen: SCREEN, method: 'email_password' });
        } catch (error: any) {
            const reason = getSignupErrorReason(error);
            await trackEvent('auth_error', { screen: SCREEN, reason });
            Alert.alert('Signup Failed', error?.message || 'An error occurred during signup');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.container}
            >
                <View style={styles.content}>
                    <View style={styles.form}>
                        <AppText style={styles.title}>Clean City</AppText>
                        <AppText style={styles.subtitle}>Join the wastemanagement kings</AppText>

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

                        <AppText style={styles.roleLabel}>Sign up as</AppText>
                        <View style={styles.roleRow}>
                            {ROLE_OPTIONS.map((opt) => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[
                                        styles.roleOption,
                                        role === opt.value && styles.roleOptionSelected,
                                    ]}
                                    onPress={() => setRole(opt.value)}
                                    disabled={isLoading}
                                >
                                    <AppText
                                        style={[
                                            styles.roleOptionText,
                                            role === opt.value && styles.roleOptionTextSelected,
                                        ]}
                                    >
                                        {opt.label}
                                    </AppText>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[styles.button, isLoading && styles.buttonDisabled]}
                            onPress={handleSignup}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <AppText style={styles.buttonText}>Sign Up</AppText>
                            )}
                        </TouchableOpacity>

                        <View style={styles.dividerRow}>
                            <View style={styles.dividerLine} />
                            <AppText style={styles.dividerText}>or continue with</AppText>
                            <View style={styles.dividerLine} />
                        </View>

                        {SHOW_APPLE_SIGN_IN && (
                            <TouchableOpacity
                                style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
                                onPress={handleAppleSignup}
                                disabled={isLoading}
                            >
                                <SocialButtonLabel
                                    provider="apple"
                                    label="Continue with Apple"
                                    textStyle={[styles.socialButtonText, styles.appleButtonText]}
                                />
                            </TouchableOpacity>
                        )}

                        <GoogleAuthButton
                            screen={SCREEN}
                            disabled={isLoading}
                            style={[styles.socialButton, isLoading && styles.buttonDisabled]}
                            textStyle={styles.socialButtonText}
                            onGoogleCredential={(credential: AuthCredential) =>
                                handleSocialSignup(credential, 'google')
                            }
                        />

                        <AppText style={styles.dividerText}>
                            Social sign-in creates a customer account
                        </AppText>
                    </View>

                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <Text style={styles.backToLogin}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

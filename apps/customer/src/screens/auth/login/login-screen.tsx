
import React, { useCallback, useEffect, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, type AuthCredential } from 'firebase/auth';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { styles } from './login-screen.styles';
import { AppText, AppTextInput, ResponsiveContent } from '@/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreenProps } from '../types';
import { trackEvent } from '@/services/analytics';
import { registerForPushNotifications } from '@/services/notifications';
import { generateNonce, sha256 } from '@/lib/social-auth';
import { GoogleAuthButton } from '../google-auth-button';
import { SocialButtonLabel } from '../social-button-label';

const SCREEN = 'login';

/** Sign in with Apple is only available on iOS; Android shows Google only. */
const SHOW_APPLE_SIGN_IN = Platform.OS === 'ios';

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
                    <ResponsiveContent style={styles.responsiveOuter} innerStyle={styles.contentContainer}>
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

                            {SHOW_APPLE_SIGN_IN && (
                                <TouchableOpacity
                                    style={[styles.socialButton, styles.appleButton, isLoading && styles.buttonDisabled]}
                                    onPress={handleAppleLogin}
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
                                    handleSocialLogin(credential, 'google')
                                }
                            />
                        </View>
                    </ResponsiveContent>

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

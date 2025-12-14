
import React, { useEffect, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { styles } from './login-screen.styles';
import { AppText, AppTextInput } from '@/components';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreenProps } from '../types';
import { trackEvent } from '@/services/analytics';
import { registerForPushNotifications } from '@/services/notifications';

const SCREEN = 'login';
const AUTH_METHOD = 'email_password';

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
    const { login } = useAuth();

    useEffect(() => {
        trackEvent('auth_screen_viewed', { screen: SCREEN });
    }, []);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        await trackEvent('login_started', {
            screen: SCREEN,
            method: AUTH_METHOD,
        });

        setIsLoading(true);
        try {
            await login(email, password);
            await registerForPushNotifications();
            await trackEvent('login_success', {
                screen: SCREEN,
                method: AUTH_METHOD,
            });
        } catch (error: any) {
            const reason = getAuthErrorReason(error);
            await trackEvent('auth_error', {
                screen: SCREEN,
                reason,
            });
            Alert.alert('Login Failed', error.message || 'An error occurred during login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = () => {
        navigation.navigate('ForgotPassword')
    }

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
                                {isLoading ? (
                                    <ActivityIndicator color={COLORS.white} />
                                ) : (
                                    <AppText style={styles.forgottenPassword}>Forgot password? Click here to reset</AppText>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>


                    <TouchableOpacity
                        style={styles.actionLink}
                        onPress={() => navigation.navigate('Signup')}
                        disabled={isLoading}
                    >
                        <AppText style={styles.linkText}>
                            Don't have an account? <AppText style={styles.linkTextBold}>Sign Up</AppText>
                        </AppText>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

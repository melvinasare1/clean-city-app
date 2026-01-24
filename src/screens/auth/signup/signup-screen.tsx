
import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform
} from 'react-native';
import { styles } from './signup-screen.styles';
import {
    AppText,
    AppTextInput
} from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignupScreenProps } from '../types';
import { trackEvent } from '@/services/analytics';

const SCREEN = 'signup';
const AUTH_METHOD = 'email_password';

const getSignupErrorReason = (error: any): string => {
    const code = error?.code as string | undefined;
    const message = (error?.message as string | undefined)?.toLowerCase() ?? '';

    if (code) {
        if (code === 'auth/email-already-in-use') {
            return 'email_in_use';
        }
        if (code === 'auth/weak-password') {
            return 'weak_password';
        }
        if (code === 'auth/invalid-email') {
            return 'invalid_email';
        }
        if (code === 'auth/network-request-failed') {
            return 'network_error';
        }
    }

    if (message.includes('network')) {
        return 'network_error';
    }

    return 'unknown';
};

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    // Optional referral code; source can be future deep link / param.
    const [referralCode, setReferralCode] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();

    useEffect(() => {
        trackEvent('auth_screen_viewed', { screen: SCREEN });
    }, []);

    const handleSignup = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);

        try {
            await trackEvent('signup_started', {
                screen: SCREEN,
                method: AUTH_METHOD,
            });

            await signup(email, password, 'customer', referralCode ?? undefined);

            await trackEvent('signup_completed', {
                screen: SCREEN,
                method: AUTH_METHOD,
            });
        } catch (error: any) {
            const reason = getSignupErrorReason(error);
            await trackEvent('auth_error', {
                screen: SCREEN,
                reason,
            });

            Alert.alert(
                'Signup Failed',
                error?.message || 'An error occurred during signup'
            );
        } finally {
            setIsLoading(false);
        }
    }

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
                    </View>

                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backToLogin}>Back to Login</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

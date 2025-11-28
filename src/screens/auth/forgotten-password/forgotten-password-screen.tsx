
import React, { useState } from 'react';
import { View, TouchableOpacity, KeyboardAvoidingView, ActivityIndicator, Platform, Alert } from 'react-native';
import {
    AppText,
    AppTextInput,
} from '@/components/ui';
import { styles } from './forgotten-password-screen.styles';
import { validateEmail } from './helpers';
import { useAuth } from '@/hooks/useAuth';
import { ForgotPasswordScreenProps } from '../types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '@/lib/constants';

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
    navigation,
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');

    const { resetPassword } = useAuth();

    const handleSendResetLink = async (): Promise<void> => {
        setSuccessMessage('');

        if (!email.trim()) {
            Alert.alert("Email can't be empty")
            return;
        }

        if (!validateEmail(email.trim())) {
            Alert.alert('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            await resetPassword(email.trim());

            setSuccessMessage(
                'If an account exists for this email, a password reset link has been sent.'
            );

            setEmail('');
        } catch (err: any) {
            let errorMessage = 'Failed to send reset link. Please try again.';

            if (err.code === 'auth/user-not-found') {
                setSuccessMessage(
                    'If an account exists for this email, a password reset link has been sent.'
                );
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address';
                Alert.alert(errorMessage);
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Too many attempts. Please try again later.';
                Alert.alert(errorMessage);
            } else {
                Alert.alert(errorMessage);
            }

            console.error('Password reset error:', err);
        } finally {
            setLoading(false);
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
                        <AppText style={styles.title}>Reset your password</AppText>
                        <AppText style={styles.subtitle}>You'll get an email with the instructions to reset</AppText>

                        <AppTextInput
                            style={styles.input}
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            editable={!loading}
                        />

                        <TouchableOpacity
                            style={[styles.button, loading && styles.buttonDisabled]}
                            onPress={handleSendResetLink}
                            disabled={loading}
                        >
                            {loading ? (
                                <ActivityIndicator color={COLORS.white} />
                            ) : (
                                <AppText style={styles.buttonText}>Reset your password</AppText>
                            )}
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                    >
                        <AppText style={styles.backToLogin}>Back to Login</AppText>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};



import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../../services/firebase/firebase-config';
import { AuthStackParamList } from '../../../navigation/auth-navigation';
import {
    ScreenContainer,
    AppText,
    AppTextInput,
    AppButton,
} from '../../../components/ui';
import { styles } from './forgotten-password-screen.styles';

type ForgotPasswordScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
    navigation,
}) => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    /**
     * Validates email format
     */
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    /**
     * Handles sending password reset email
     * Uses Firebase Auth sendPasswordResetEmail
     */
    const handleSendResetLink = async (): Promise<void> => {
        // Clear previous messages
        setError('');
        setSuccessMessage('');

        // Validate email
        if (!email.trim()) {
            setError('Please enter your email address');
            return;
        }

        if (!validateEmail(email.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        setLoading(true);

        try {
            // Send password reset email using Firebase Auth
            await sendPasswordResetEmail(auth, email.trim());

            // Show success message
            setSuccessMessage(
                'If an account exists for this email, a password reset link has been sent.'
            );

            // Clear the email input
            setEmail('');
        } catch (err: any) {
            // Handle different error types
            let errorMessage = 'Failed to send reset link. Please try again.';

            if (err.code === 'auth/user-not-found') {
                // For security, we show the same message even if user doesn't exist
                setSuccessMessage(
                    'If an account exists for this email, a password reset link has been sent.'
                );
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address';
                setError(errorMessage);
            } else if (err.code === 'auth/too-many-requests') {
                errorMessage = 'Too many attempts. Please try again later.';
                setError(errorMessage);
            } else {
                setError(errorMessage);
            }

            console.error('Password reset error:', err);
        } finally {
            setLoading(false);
        }
    };

    /**
     * Navigate back to login screen
     */
    const handleBackToLogin = (): void => {
        navigation.navigate('Login');
    };

    return (
        <ScreenContainer style={styles.container}>
            <View style={styles.content}>
                <AppText style={styles.title}>Reset your password</AppText>
                <AppText style={styles.subtitle}>
                    Enter your email and we'll send you a link to reset your password.
                </AppText>

                <View style={styles.form}>
                    <View style={styles.inputWrapper}>
                        <AppTextInput
                            placeholder="Email"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            editable={!loading}
                        />
                        {error && !successMessage && (
                            <AppText style={styles.errorText}>{error}</AppText>
                        )}
                    </View>

                    <AppButton
                        title="Send reset link"
                        onPress={handleSendResetLink}
                        loading={loading}
                        buttonStyle={styles.button}
                    />

                    {successMessage && (
                        <AppText style={styles.successText}>{successMessage}</AppText>
                    )}
                </View>

                <View style={styles.backToLoginContainer}>
                    <TouchableOpacity onPress={handleBackToLogin} disabled={loading}>
                        <AppText style={styles.backToLoginText}>Back to login</AppText>
                    </TouchableOpacity>
                </View>
            </View>
        </ScreenContainer>
    );
};


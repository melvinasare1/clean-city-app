
import React, { useState } from 'react';
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
import { AppText, AppTextInput } from '@/components/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LoginScreenProps } from '../types';

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { login } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            await login(email, password);
        } catch (error: any) {
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

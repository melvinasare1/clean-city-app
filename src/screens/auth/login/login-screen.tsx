
import React, { useState } from 'react';
import {
    View,
    TouchableOpacity,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { styles } from './login-screen.styles';
import { AppText, AppTextInput } from '@/components/ui';

type AuthStackParamList = {
    Login: undefined;
    Signup: undefined;
};

type LoginScreenProps = {
    navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

export const LoginScreen: React.FC<LoginScreenProps> = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { loginWithEmailPassword } = useAuth();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        setIsLoading(true);
        try {
            await loginWithEmailPassword(email, password);
            // Navigation will happen automatically via auth state change
        } catch (error: any) {
            Alert.alert('Login Failed', error.message || 'An error occurred during login');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.container}
        >
            <View style={styles.content}>
                <AppText style={styles.title}>Clean City</AppText>
                <AppText style={styles.subtitle}>Waste Management Made Easy</AppText>

                <View style={styles.form}>
                    <AppTextInput
                        style={styles.input}
                        placeholder="Email"
                        placeholderTextColor={COLORS.textSecondary}
                        value={email}
                        onChangeText={setEmail}
                        autoCapitalize="none"
                        keyboardType="email-address"
                        editable={!isLoading}
                    />

                    <AppTextInput
                        style={styles.input}
                        placeholder="Password"
                        placeholderTextColor={COLORS.textSecondary}
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
                        onPress={() => navigation.navigate('Signup')}
                        disabled={isLoading}
                    >
                        <AppText style={styles.linkText}>
                            Don't have an account? <AppText style={styles.linkTextBold}>Sign Up</AppText>
                        </AppText>
                    </TouchableOpacity>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
};


import React, { useState } from 'react';
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
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SignupScreenProps } from '../types';

export const SignupScreen: React.FC<SignupScreenProps> = ({ navigation }) => {

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { signup } = useAuth();

    const handleSignup = async (email: string, password: string) => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }

        await signup(email, password);
        setIsLoading(true);
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
                            onPress={() => handleSignup(email, password)}
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

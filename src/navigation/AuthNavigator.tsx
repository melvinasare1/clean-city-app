/**
 * Auth Navigator
 * 
 * Stack navigator for authentication flow (Login, Signup)
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '../screens/auth/login/login-screen';
import { SignupScreen } from '../screens/auth/signup/signup-screen';
import { ForgotPasswordScreen } from '../screens/auth/forgotten-password/forgotten-password-screen';

export type AuthStackParamList = {
    Login: undefined;
    Signup: undefined;
    ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => {
    return (
        <Stack.Navigator
            screenOptions={{
                headerShown: false,
            }}
        >
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen
                name="Signup"
                component={SignupScreen}
                options={{
                    headerShown: true,
                    title: 'Sign Up',
                }}
            />
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{
                    headerShown: true,
                    title: 'Forgot Password',
                }}
            />
        </Stack.Navigator>
    );
};


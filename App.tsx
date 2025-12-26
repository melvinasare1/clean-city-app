// Polyfills for Firebase Web SDK on React Native
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import Aptabase, { trackEvent } from '@aptabase/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '@/services/notifications/notificationHandler';
import { useNotificationListeners } from '@/services/notifications';

// Initialize Aptabase analytics
Aptabase.init('A-EU-6592512622');

export default function App() {
    // Mount push notification listeners once at the root of the app.
    useNotificationListeners();
    
    // Track app startup (recommended by Aptabase)
    useEffect(() => {
        trackEvent('app_started');
    }, []);

    return (
        <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <BottomSheetModalProvider>
                    <NavigationContainer>
                        <StatusBar style="auto" />
                        <RootNavigator />
                    </NavigationContainer>
                </BottomSheetModalProvider>
            </GestureHandlerRootView>
        </AuthProvider>
    );
}


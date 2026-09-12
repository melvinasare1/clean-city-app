
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import 'react-native-gesture-handler';
import * as WebBrowser from 'expo-web-browser';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';

WebBrowser.maybeCompleteAuthSession();
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '@/services/notifications/notificationHandler';
import { useNotificationListeners } from '@/services/notifications';
import { init } from '@aptabase/react-native';
import Constants from 'expo-constants';

SplashScreen.preventAutoHideAsync().catch(() => {});

const APTABASE_APP_KEY =
    Constants.expoConfig?.extra?.aptabaseKey ||
    process.env.EXPO_PUBLIC_APTABASE_KEY;

if (APTABASE_APP_KEY) {
    init(APTABASE_APP_KEY);
    console.log('[Aptabase] ✅ Initialized with key:', APTABASE_APP_KEY.substring(0, 8) + '...');
} else {
    console.error('[Aptabase] ❌ No API key found!');
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.warn(
            '[Aptabase] EXPO_PUBLIC_APTABASE_KEY is not configured. Analytics events will not be sent.'
        );
    }
}

export default function App() {
    useNotificationListeners();

    useEffect(() => {
        SplashScreen.hideAsync().catch(() => {});
    }, []);

    return (
        <AuthProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
                <SafeAreaProvider>
                    <BottomSheetModalProvider>
                        <NavigationContainer>
                            <StatusBar style="auto" />
                            <RootNavigator />
                        </NavigationContainer>
                    </BottomSheetModalProvider>
                </SafeAreaProvider>
            </GestureHandlerRootView>
        </AuthProvider>
    );
}

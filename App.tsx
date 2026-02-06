
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { BookingsProvider } from '@/contexts/bookings-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '@/services/notifications/notificationHandler';
import { useNotificationListeners } from '@/services/notifications';
import { init } from '@aptabase/react-native';
import Constants from 'expo-constants';

// Initialize Aptabase as early as possible in the app lifecycle.
// The App Key is provided via Expo env as EXPO_PUBLIC_APTABASE_KEY (set in eas.json or CI).
// IMPORTANT: Use expo-constants for production builds for reliable access
const APTABASE_APP_KEY = 
    Constants.expoConfig?.extra?.aptabaseKey || 
    process.env.EXPO_PUBLIC_APTABASE_KEY;

if (APTABASE_APP_KEY) {
    init(APTABASE_APP_KEY);
    console.log('[Aptabase] ✅ Initialized with key:', APTABASE_APP_KEY.substring(0, 8) + '...');
} else {
    console.error('[Aptabase] ❌ No API key found!');
    console.error('[Aptabase] Checked sources:', {
        expoConfig: Constants.expoConfig?.extra?.aptabaseKey ? 'found' : 'missing',
        processEnv: process.env.EXPO_PUBLIC_APTABASE_KEY ? 'found' : 'missing',
    });
    
    // In development, surface a helpful warning if the key is missing.
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn(
            '[Aptabase] EXPO_PUBLIC_APTABASE_KEY is not configured. Analytics events will not be sent.'
        );
    }
}

export default function App() {
    // Mount push notification listeners once at the root of the app.
    useNotificationListeners();

    return (
        <AuthProvider>
            <BookingsProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                    <BottomSheetModalProvider>
                        <NavigationContainer>
                            <StatusBar style="auto" />
                            <RootNavigator />
                        </NavigationContainer>
                    </BottomSheetModalProvider>
                </GestureHandlerRootView>
            </BookingsProvider>
        </AuthProvider>
    );
}


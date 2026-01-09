
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '@/services/notifications/notificationHandler';
import { useNotificationListeners } from '@/services/notifications';
import { init } from '@aptabase/react-native';

// Initialize Aptabase as early as possible in the app lifecycle.
// The App Key should be provided via EAS/Expo env as EXPO_PUBLIC_APTABASE_KEY.
const APTABASE_APP_KEY = process.env.EXPO_PUBLIC_APTABASE_KEY;

if (APTABASE_APP_KEY) {
    init(APTABASE_APP_KEY);
} else {
    // In development, surface a helpful warning if the key is missing.
    // In production this will be stripped by Metro when __DEV__ is false.
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


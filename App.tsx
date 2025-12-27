
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import '@/services/notifications/notificationHandler';
import { useNotificationListeners } from '@/services/notifications';

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


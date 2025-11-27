
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { RootNavigator } from './src/navigation/root-navigation';
import { AuthProvider } from '@/contexts/auth-context';

export default function App() {
    return (
        <AuthProvider>
            <NavigationContainer>
                <StatusBar style="auto" />
                <RootNavigator />
            </NavigationContainer>
        </AuthProvider>
    );
}


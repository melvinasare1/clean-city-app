
import React, { useEffect, useRef } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './auth-navigation';
import { CustomerNavigator } from './customer-navigation';
import { DriverNavigator } from './driver-navigation';
import { AdminNavigator } from './admin-navigation';
import { COLORS } from '../lib/constants';
import { trackEvent } from '@/services/analytics';
import { isAdmin } from '@/lib/admin';

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();
    const hasTrackedAppOpen = useRef(false);

    useEffect(() => {
        if (loading || hasTrackedAppOpen.current) {
            return;
        }

        let initialScreen: string;

        if (!user) {
            initialScreen = 'login';
        } else if (isAdmin(user)) {
            initialScreen = 'admin_push';
        } else if (user.role === 'driver') {
            initialScreen = 'driver_home';
        } else {
            initialScreen = 'customer_home';
        }

        hasTrackedAppOpen.current = true;
        trackEvent('app_open', { screen: initialScreen });
    }, [loading, user?.role]);

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    if (!user) {
        return <AuthNavigator />;
    }

    if (isAdmin(user)) {
        return <AdminNavigator />;
    }

    if (user.role === 'driver') {
        return <DriverNavigator />;
    }

    return (
        <CustomerNavigator />
    );
};

const styles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
    },
});


import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './auth-navigation';
import { CustomerNavigator } from './customer-navigation';
import { DriverNavigator } from './driver-navigation';
import { AdminNavigator } from './admin-navigation';
import { DriverStatusProvider } from '@/contexts/driver-status-context';
import { getDriverStatus, type DriverStatus } from '@/services/driver-api';
import { COLORS } from '../lib/constants';
import { trackEvent } from '@/services/analytics';
import { isAdmin } from '@/lib/admin';

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();
    const hasTrackedAppOpen = useRef(false);
    const [driverStatusLoading, setDriverStatusLoading] = useState(false);
    const [driverStatusResult, setDriverStatusResult] = useState<DriverStatus | null>(null);

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

    useEffect(() => {
        if (user?.role !== 'driver' || !user?.id) {
            setDriverStatusLoading(false);
            setDriverStatusResult(null);
            return;
        }
        let cancelled = false;
        setDriverStatusLoading(true);
        getDriverStatus(user.id)
            .then((s) => {
                if (!cancelled) {
                    setDriverStatusResult(s ?? null);
                }
            })
            .catch((err) => {
                console.error('[RootNavigator] getDriverStatus failed:', err);
                if (!cancelled) {
                    setDriverStatusResult(null);
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setDriverStatusLoading(false);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [user?.role, user?.id]);

    const refreshDriverStatus = useCallback(async () => {
        if (!user?.id) return;
        const s = await getDriverStatus(user.id);
        setDriverStatusResult(s ?? null);
    }, [user?.id]);

    const showLoading = loading || (user?.role === 'driver' && driverStatusLoading);

    if (showLoading) {
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
        const isApproved =
            driverStatusResult !== null && driverStatusResult.isActive === true;
        return (
            <DriverStatusProvider
                value={{
                    refreshDriverStatus,
                    isApproved,
                    statusLoading: driverStatusLoading,
                }}
            >
                <DriverNavigator />
            </DriverStatusProvider>
        );
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


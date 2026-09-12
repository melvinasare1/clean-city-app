import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@platform/shared-firebase';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './auth-navigation';
import { DriverNavigator } from './driver-navigation';
import { DriverStatusProvider } from '@/contexts/driver-status-context';
import { DriverShiftProvider } from '@/contexts/driver-shift-context';
import { COLORS } from '../lib/constants';
import { trackEvent } from '@/services/analytics';
import { WrongAppScreen } from '@/screens/wrong-app-screen';
import {
  isDriverApprovedStatus,
  normalizeDriverStatus,
  type DriverAccountStatus,
} from '@/lib/driver-account';

type DriverStatus = {
  status: DriverAccountStatus;
  isApproved: boolean;
};

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();
    const hasTrackedAppOpen = useRef(false);
    const [driverStatusLoading, setDriverStatusLoading] = useState(false);
    const [driverStatusResult, setDriverStatusResult] = useState<DriverStatus | null>(null);

    useEffect(() => {
        if (loading || hasTrackedAppOpen.current) {
            return;
        }

        const initialScreen = !user ? 'login' : user.role === 'driver' ? 'driver_home' : 'wrong_app';
        hasTrackedAppOpen.current = true;
        trackEvent('app_open', { screen: initialScreen });
    }, [loading, user?.role]);

    useEffect(() => {
        if (user?.role !== 'driver' || !user?.id) {
            setDriverStatusLoading(false);
            setDriverStatusResult(null);
            return;
        }

        setDriverStatusLoading(true);
        const unsub = onSnapshot(
            doc(db, 'drivers', user.id),
            (snap) => {
                if (!snap.exists()) {
                    setDriverStatusResult({ status: 'pending', isApproved: false });
                    setDriverStatusLoading(false);
                    return;
                }
                const status = normalizeDriverStatus(snap.data() as Record<string, unknown>);
                setDriverStatusResult({
                    status,
                    isApproved: isDriverApprovedStatus(status),
                });
                setDriverStatusLoading(false);
            },
            (err) => {
                console.error('[RootNavigator] driver status listener failed:', err);
                setDriverStatusLoading(false);
            }
        );
        return unsub;
    }, [user?.role, user?.id]);

    const refreshDriverStatus = useCallback(async () => {
        // Live listener keeps status current; no-op keeps call sites working.
    }, []);

    const showLoading = loading || (user?.role === 'driver' && driverStatusLoading && !driverStatusResult && !user.driverStatus);

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

    if (user.role !== 'driver') {
        return <WrongAppScreen expectedLabel="driver" />;
    }

    const isApproved =
        driverStatusResult?.isApproved === true ||
        user.driverStatus === 'approved';
    return (
        <DriverStatusProvider
            value={{
                refreshDriverStatus,
                isApproved,
                statusLoading: driverStatusLoading,
            }}
        >
            <DriverShiftProvider>
                <DriverNavigator />
            </DriverShiftProvider>
        </DriverStatusProvider>
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

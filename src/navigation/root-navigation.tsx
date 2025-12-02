
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './auth-navigation';
import { CustomerNavigator } from './customer-navigation';
import { DriverNavigator } from './driver-navigation';
import { COLORS } from '../lib/constants';

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();

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


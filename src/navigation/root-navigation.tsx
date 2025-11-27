
import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './auth-navigation';
import { CustomerNavigator } from './customer-navigation';
import { DriverNavigator } from './driver-navigation';
import { RoleSelectorScreen } from '../screens/role-selector/role-selector-screen';
import { COLORS } from '../lib/constants';
import { UserRole } from '../types/user';

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

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

    if (!selectedRole) {
        return <RoleSelectorScreen onSelectRole={setSelectedRole} />;
    }

    if (selectedRole === 'customer') {
        return <CustomerNavigator />;
    }

    if (selectedRole === 'driver') {
        return <DriverNavigator />;
    }

    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
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


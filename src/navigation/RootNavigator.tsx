/**
 * Root Navigator
 * 
 * Main navigation orchestrator that:
 * - Shows auth flow when user is not logged in
 * - Shows role selector after login (temporary)
 * - Shows customer or driver navigation based on selected role
 */

import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AuthNavigator } from './AuthNavigator';
import { CustomerNavigator } from './CustomerNavigator';
import { DriverNavigator } from './DriverNavigator';
import { RoleSelectorScreen } from '../screens/common/role-selector-screen';
import { COLORS } from '../lib/constants';
import { UserRole } from '../types/user';

export const RootNavigator: React.FC = () => {
    const { user, loading } = useAuth();
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

    // Show loading indicator while checking auth state
    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
        );
    }

    // If user is not authenticated, show auth flow
    if (!user) {
        return <AuthNavigator />;
    }

    // TODO: In production, fetch the user's role from Firestore instead of using RoleSelector
    // For now, we use a temporary role selector screen
    if (!selectedRole) {
        return <RoleSelectorScreen onSelectRole={setSelectedRole} />;
    }

    // Show appropriate navigator based on user role
    if (selectedRole === 'customer') {
        return <CustomerNavigator />;
    }

    if (selectedRole === 'driver') {
        return <DriverNavigator />;
    }

    // Fallback (should never reach here)
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


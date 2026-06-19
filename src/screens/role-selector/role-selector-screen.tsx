
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { ResponsiveContent } from '@/components';
import { styles } from './role-selector-screen.styles';

type RoleSelectorScreenProps = {
    onSelectRole: (role: 'customer' | 'driver') => void;
};

export const RoleSelectorScreen: React.FC<RoleSelectorScreenProps> = ({ onSelectRole }) => {
    return (
        <View style={styles.container}>
            <ResponsiveContent style={styles.responsiveOuter} innerStyle={styles.content}>
                <Text style={styles.title}>Select Your Role</Text>
                <Text style={styles.subtitle}>
                    This is temporary. In production, your role will be automatically loaded from Firestore.
                </Text>

                <TouchableOpacity
                    style={styles.roleButton}
                    onPress={() => onSelectRole('customer')}
                >
                    <Text style={styles.roleEmoji}>👤</Text>
                    <Text style={styles.roleTitle}>Continue as Customer</Text>
                    <Text style={styles.roleDescription}>
                        Schedule waste pickups and manage your bookings
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.roleButton, styles.roleButtonDriver]}
                    onPress={() => onSelectRole('driver')}
                >
                    <Text style={styles.roleEmoji}>🚛</Text>
                    <Text style={styles.roleTitle}>Continue as Driver</Text>
                    <Text style={styles.roleDescription}>
                        View and complete assigned waste collection jobs
                    </Text>
                </TouchableOpacity>
            </ResponsiveContent>
        </View>
    );
};

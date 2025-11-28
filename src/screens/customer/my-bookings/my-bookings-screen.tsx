import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, ScreenContainer } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { CustomerStackParamList } from '@/navigation/types';
import { COLORS } from '@/lib/constants';
import { styles } from './my-bookings-screen.styles';

type MyBookingsScreenProps = NativeStackScreenProps<
    CustomerStackParamList,
    'MyBookings'
>;

const mockBookings = [
    {
        id: '1',
        date: 'Nov 25, 2025',
        status: 'pending',
        total: 125,
    },
    {
        id: '2',
        date: 'Nov 20, 2025',
        status: 'completed',
        total: 100,
    },
];

const getStatusColor = (status: string) => {
    switch (status) {
        case 'pending':
            return COLORS.accent;
        case 'assigned':
            return '#2196F3';
        case 'in_progress':
            return '#FF9800';
        case 'completed':
            return COLORS.success;
        case 'cancelled':
            return COLORS.error;
        default:
            return COLORS.textSecondary;
    }
};

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
    navigation,
}) => {
    const { user } = useAuth();
    const needsProfileCompletion = !user?.phone || !user?.location;

    return (
        <ScreenContainer scrollable>
            <View style={styles.content}>
                {needsProfileCompletion && (
                    <TouchableOpacity
                        style={styles.profileBanner}
                        onPress={() => navigation.navigate('CompleteProfile')}
                    >
                        <AppText style={styles.bannerTitle}>Complete your profile</AppText>
                        <AppText style={styles.bannerSubtitle}>
                            Add your contact number and service area so we can handle your
                            bookings smoothly.
                        </AppText>
                    </TouchableOpacity>
                )}

                <AppText style={styles.title}>My Bookings</AppText>

                {mockBookings.map((booking) => (
                    <TouchableOpacity key={booking.id} style={styles.card}>
                        <View style={styles.cardHeader}>
                            <AppText style={styles.cardDate}>{booking.date}</AppText>
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: getStatusColor(booking.status) },
                                ]}
                            >
                                <AppText style={styles.statusText}>
                                    {booking.status.toUpperCase()}
                                </AppText>
                            </View>
                        </View>
                        <AppText style={styles.cardPrice}>
                            Total: GHS {booking.total}
                        </AppText>
                        <AppText style={styles.cardNote}>
                            Tap to view details (coming soon)
                        </AppText>
                    </TouchableOpacity>
                ))}

                <View style={styles.placeholderCard}>
                    <AppText style={styles.placeholderText}>
                        📱 Bookings will be loaded from Firestore in the next phase
                    </AppText>
                </View>
            </View>
        </ScreenContainer>
    );
};



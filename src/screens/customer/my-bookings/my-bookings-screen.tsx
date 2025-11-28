import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, ScreenContainer } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import {
    CustomerStackParamList,
    CustomerTabParamList,
} from '@/navigation/types';
import { Booking, getUserBookings } from '@/services/bookingService';
import { COLORS } from '@/lib/constants';
import { styles } from './my-bookings-screen.styles';

type MyBookingsScreenProps = CompositeScreenProps<
    BottomTabScreenProps<CustomerTabParamList, 'MyBookings'>,
    NativeStackScreenProps<CustomerStackParamList>
>;

const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T00:00:00`);
    return date.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getStatusColor = (status: Booking['status']) => {
    switch (status) {
        case 'pending':
            return COLORS.accent;
        case 'completed':
            return COLORS.success;
        case 'cancelled':
        default:
            return COLORS.error;
    }
};

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
    navigation,
}) => {
    const { user } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const needsProfileCompletion = !user?.phone || !user?.location;

    const fetchBookings = useCallback(async () => {
        if (!user) {
            setBookings([]);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const data = await getUserBookings(user.id);
            setBookings(data);
            setError(null);
        } catch (err) {
            console.error('Error loading bookings:', err);
            setError('We could not load your bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            fetchBookings();
        }, [fetchBookings])
    );

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

                <View style={styles.headerRow}>
                    <AppText style={styles.title}>My Bookings</AppText>
                    <TouchableOpacity
                        style={styles.newBookingButton}
                        onPress={() => navigation.navigate('CreateBooking')}
                    >
                        <AppText style={styles.newBookingButtonText}>+ Schedule</AppText>
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator color={COLORS.primary} />
                        <AppText style={styles.loadingText}>Loading bookings...</AppText>
                    </View>
                ) : error ? (
                    <View style={styles.errorState}>
                        <AppText style={styles.errorText}>{error}</AppText>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={fetchBookings}
                        >
                            <AppText style={styles.retryButtonText}>Try again</AppText>
                        </TouchableOpacity>
                    </View>
                ) : bookings.length === 0 ? (
                    <View style={styles.emptyState}>
                        <AppText style={styles.emptyTitle}>No bookings yet</AppText>
                        <AppText style={styles.emptySubtitle}>
                            Schedule your first pickup and keep your area clean.
                        </AppText>
                        <TouchableOpacity
                            style={styles.emptyAction}
                            onPress={() => navigation.navigate('CreateBooking')}
                        >
                            <AppText style={styles.emptyActionText}>
                                Schedule your first pickup
                            </AppText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    bookings.map((booking) => (
                        <View key={booking.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <AppText style={styles.cardDate}>
                                    {formatDate(booking.date)}
                                </AppText>
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
                            <AppText style={styles.cardWindow}>{booking.windowLabel}</AppText>
                            <AppText style={styles.cardLocation}>{booking.location}</AppText>
                        </View>
                    ))
                )}
            </View>
        </ScreenContainer>
    );
};
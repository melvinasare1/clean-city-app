import React, { useCallback, useLayoutEffect, useState } from 'react';
import {
    ActivityIndicator,
    ActionSheetIOS,
    Alert,
    Linking,
    Platform,
    ScrollView,
    TouchableOpacity,
    View,
} from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, AppButton } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import {
    CustomerStackParamList,
    CustomerTabParamList,
} from '@/navigation/types';
import type { Booking } from '@/types/booking';
import { getUserBookings, initiatePaymentForBooking, verifyBookingPayment } from '@/services/booking-service';
import { COLORS } from '@/lib/constants';
import { styles } from './my-bookings-screen.styles';
import { trackEvent } from '@/services/analytics';

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

const formatPrice = (value: number) => `GHS ${value.toFixed(2)}`;

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

const getBinSummary = (items: Booking['items']) => {
    if (!items?.length) {
        return 'No bins recorded';
    }
    return items.map((item) => `${item.quantity} x ${item.type}`).join(', ');
};

const SCREEN = 'my_bookings';

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
    navigation,
}) => {
    const { user, logout } = useAuth();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingPayment, setProcessingPayment] = useState<string | null>(null);
    const [verifyingBookings, setVerifyingBookings] = useState<Set<string>>(new Set());

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
            
            // Silently verify payments in background (non-blocking)
            const pendingPayments = data.filter(
                booking => booking.payment.status !== "paid" && booking.payment.reference
            );
            
            if (pendingPayments.length > 0) {
                console.log(`[Auto-verify] Found ${pendingPayments.length} bookings with references, verifying in background...`);
                
                // Mark these bookings as being verified
                const verifyingIds = new Set(pendingPayments.map(b => b.id));
                setVerifyingBookings(verifyingIds);
                
                // Run verification in background without blocking UI
                Promise.all(
                    pendingPayments.map(booking => 
                        verifyBookingPayment(booking.id, false) // throwOnError = false
                    )
                ).then(results => {
                    const verifiedCount = results.filter(r => r === true).length;
                    if (verifiedCount > 0) {
                        console.log(`[Auto-verify] ✅ ${verifiedCount} payment(s) verified as paid, refreshing...`);
                        // Silently refetch to update UI
                        getUserBookings(user.id).then(updatedData => {
                            setBookings(updatedData);
                            setVerifyingBookings(new Set());
                        }).catch(err => {
                            console.warn('[Auto-verify] Failed to refetch bookings:', err);
                            setVerifyingBookings(new Set());
                        });
                    } else {
                        console.log(`[Auto-verify] No payments were verified as paid`);
                        setVerifyingBookings(new Set());
                    }
                }).catch(err => {
                    // Completely silent - don't show error to user
                    console.warn('[Auto-verify] Background verification failed:', err);
                    setVerifyingBookings(new Set());
                });
            }
        } catch (err) {
            console.error('Error loading bookings:', err);
            setError('We could not load your bookings. Please try again.');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    const handleActionSelection = useCallback(
        async (index: number) => {
            // 0: Leave feedback, 1: Get support, 2: Log out, 3: Cancel
            if (index === 0) {
                Linking.openURL('mailto:support@cleancitygh.com').catch((err) =>
                    console.warn('Failed to open mail client', err)
                );
            } else if (index === 1) {
                // Open WhatsApp chat with business number
                const whatsappUrl = 'https://wa.me/233241735474';
                Linking.openURL(whatsappUrl).catch((err) =>
                    console.warn('Failed to open WhatsApp', err)
                );
            } else if (index === 2) {
                try {
                    await logout();
                    await trackEvent('logout', { screen: 'settings' });
                } catch (err) {
                    console.error('Error during logout:', err);
                    Alert.alert(
                        'Logout failed',
                        'We could not log you out. Please try again.'
                    );
                }
            }
        },
        [logout]
    );

    const showOptionsSheet = useCallback(() => {
        const options = ['Leave feedback', 'Get support', 'Log out', 'Cancel'];
        const destructiveButtonIndex = 2;
        const cancelButtonIndex = 3;

        if (Platform.OS === 'ios') {
            ActionSheetIOS.showActionSheetWithOptions(
                {
                    options,
                    destructiveButtonIndex,
                    cancelButtonIndex,
                },
                (buttonIndex) => {
                    if (typeof buttonIndex === 'number') {
                        handleActionSelection(buttonIndex);
                    }
                }
            );
        } else {
            Alert.alert(
                'Options',
                undefined,
                [
                    {
                        text: 'Leave feedback',
                        onPress: () => handleActionSelection(0),
                    },
                    {
                        text: 'Get support',
                        onPress: () => handleActionSelection(1),
                    },
                    {
                        text: 'Log out',
                        style: 'destructive',
                        onPress: () => handleActionSelection(2),
                    },
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                ]
            );
        }
    }, [handleActionSelection]);

    useFocusEffect(
        useCallback(() => {
            fetchBookings();
        }, [fetchBookings])
    );

    const handleContinuePayment = useCallback(
        async (booking: Booking) => {
            if (!user?.email) {
                Alert.alert(
                    'Email required',
                    'We need your email address to process the payment. Please update your profile.'
                );
                return;
            }

            try {
                setProcessingPayment(booking.id);

                // First, verify if payment is already completed
                console.log('[Manual verify] Checking payment status for booking:', booking.id);
                
                try {
                    const isAlreadyPaid = await verifyBookingPayment(
                        booking.id,
                        true // throwOnError = true
                    );
                    
                    if (isAlreadyPaid) {
                        // Refetch booking to get updated status
                        await fetchBookings();
                        
                        Alert.alert(
                            'Already Paid ✅',
                            'This booking has already been paid for. Your booking list has been updated.',
                            [{ text: 'OK' }]
                        );
                        return;
                    }
                } catch (verifyError: any) {
                    // If verification fails due to network, show error but allow retry
                    console.warn('[Manual verify] Verification failed:', verifyError.message);
                    
                    if (verifyError.message.includes('Network') || verifyError.message.includes('non-JSON')) {
                        Alert.alert(
                            'Connection Error',
                            'Could not verify payment status. Please check your internet connection and try again.',
                            [{ text: 'OK' }]
                        );
                        return;
                    }
                    
                    // For other errors, continue to payment
                    console.log('[Manual verify] Continuing to payment despite verification error');
                }

                // If authorizationUrl exists, open it
                if (booking.payment.authorizationUrl) {
                    console.log('[Payment] Opening existing authorization URL');
                    await Linking.openURL(booking.payment.authorizationUrl);
                    Alert.alert(
                        'Complete payment',
                        'Please complete your payment in the opened page to confirm your booking.'
                    );
                } else {
                    // Otherwise, initialize new payment for SAME booking
                    console.log('[Payment] Initializing new payment for existing booking');
                    const { authorizationUrl } = await initiatePaymentForBooking(
                        booking.id,
                        user.email
                    );
                    await Linking.openURL(authorizationUrl);
                    Alert.alert(
                        'Complete payment',
                        'Please complete your payment in the opened page to confirm your booking.',
                        [{ text: 'OK', onPress: () => fetchBookings() }]
                    );
                }
            } catch (err: any) {
                console.error('[Payment] Error:', err);
                Alert.alert(
                    'Payment error',
                    err?.message || 'Could not start payment. Please try again.'
                );
            } finally {
                setProcessingPayment(null);
            }
        },
        [user?.email, fetchBookings]
    );

    useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    style={styles.headerOptionsButton}
                    onPress={showOptionsSheet}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <View style={styles.headerOptionsDots}>
                        <View style={styles.headerDot} />
                        <View style={styles.headerDot} />
                        <View style={styles.headerDot} />
                    </View>
                </TouchableOpacity>
            ),
        });
    }, [navigation, showOptionsSheet]);

    return (
        <ScrollView style={styles.content}>
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
                    onPress={() => {
                        trackEvent('activation_started', {
                            screen: SCREEN,
                            source: 'header_button',
                        });
                        navigation.navigate('NewBooking');
                    }}
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
                        onPress={() => {
                            trackEvent('activation_started', {
                                screen: SCREEN,
                                source: 'empty_state_cta',
                            });
                            navigation.navigate('NewBooking');
                        }}
                    >
                        <AppText style={styles.emptyActionText}>
                            Schedule your first pickup
                        </AppText>
                    </TouchableOpacity>
                </View>
            ) : (
                bookings.map((booking) => {
                    const isPaid = booking.payment.status === "paid";
                    const needsPayment = !isPaid;
                    const isProcessing = processingPayment === booking.id;
                    const isVerifying = verifyingBookings.has(booking.id);

                    return (
                        <View key={booking.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <AppText style={styles.cardDate}>
                                    {formatDate(booking.date)}
                                </AppText>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    {booking.type === "subscription" && (
                                        <View style={[styles.statusBadge, { backgroundColor: COLORS.primary }]}>
                                            <AppText style={styles.statusText}>
                                                SUBSCRIPTION
                                            </AppText>
                                        </View>
                                    )}
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
                            </View>
                            <AppText style={styles.cardWindow}>
                                {booking.windowLabel}
                                {booking.type === "subscription" &&
                                    booking.recurrence?.intervalWeeks && (
                                        <>
                                            {" "}
                                            •{" "}
                                            {booking.recurrence.intervalWeeks === 1
                                                ? "Every week"
                                                : `Every ${booking.recurrence.intervalWeeks} weeks`}
                                        </>
                                    )}
                            </AppText>
                            <AppText style={styles.cardLocation}>
                                Pickup area: {booking.location}
                            </AppText>
                            <AppText style={styles.cardSummary}>
                                {getBinSummary(booking.items)}
                            </AppText>
                            <AppText style={styles.cardTotal}>
                                Total: {formatPrice(booking.totalPrice)}
                            </AppText>

                            {/* Payment Status Section */}
                            <View style={styles.paymentStatusContainer}>
                                {isPaid ? (
                                    <View
                                        style={[
                                            styles.paymentStatusBadge,
                                            { backgroundColor: COLORS.success },
                                        ]}
                                    >
                                        <AppText style={styles.paymentStatusText}>
                                            ✓ PAID
                                        </AppText>
                                    </View>
                                ) : isVerifying ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <ActivityIndicator size="small" color={COLORS.primary} />
                                        <AppText style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                            Checking payment status...
                                        </AppText>
                                    </View>
                                ) : (
                                    <View
                                        style={[
                                            styles.paymentStatusBadge,
                                            {
                                                backgroundColor:
                                                    booking.payment.status === "initiated"
                                                        ? "#FFA500"
                                                        : "#FF6B6B",
                                            },
                                        ]}
                                    >
                                        <AppText style={styles.paymentStatusText}>
                                            {booking.payment.status === "initiated"
                                                ? "⚠ PAYMENT PENDING"
                                                : "❌ PAYMENT REQUIRED"}
                                        </AppText>
                                    </View>
                                )}
                            </View>

                            {/* Continue Payment Button - ONLY show if NOT paid */}
                            {needsPayment && !isVerifying && (
                                <TouchableOpacity
                                    style={styles.continuePaymentButton}
                                    onPress={() => handleContinuePayment(booking)}
                                    disabled={isProcessing}
                                >
                                    {isProcessing ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <AppText style={styles.continuePaymentButtonText}>
                                            Continue payment
                                        </AppText>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
};
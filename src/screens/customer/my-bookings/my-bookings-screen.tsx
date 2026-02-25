import React, { useCallback, useLayoutEffect, useState, useEffect } from 'react';
import {
    ActivityIndicator,
    ActionSheetIOS,
    Alert,
    Linking,
    Platform,
    RefreshControl,
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
import { initiatePaymentForBooking, verifyBookingPayment, deleteBooking } from '@/services/booking-service';
import { cancelSubscription, getSubscriptionPaymentUrl, verifyPaymentByReference } from '@/services/payments';
import { COLORS, VARS } from '@/lib/constants';
import { styles } from './my-bookings-screen.styles';
import {
    formatDate,
    formatPrice,
    formatSubscriptionDate,
    getBinSummary,
    getStatusColor,
    getSubscriptionStatusColor,
    getSubscriptionStatusLabel,
    isPaymentOverdue,
    SCREEN,
} from './my-bookings-screen.utils';
import { trackEvent } from '@/services/analytics';
import { useBookings } from '@/contexts/bookings-context';
import { useSubscriptions } from '@/contexts/subscriptions-context';
import type { Subscription } from '@/types/subscription';

type MyBookingsScreenProps = CompositeScreenProps<
    BottomTabScreenProps<CustomerTabParamList, 'MyBookings'>,
    NativeStackScreenProps<CustomerStackParamList>
>;

export const MyBookingsScreen: React.FC<MyBookingsScreenProps> = ({
    navigation,
}) => {
    const { user, logout } = useAuth();
    const {
        bookings,
        loading,
        error,
        subscribeToUserBookings,
        refreshBookings,
        removeBookingOptimistically,
    } = useBookings();
    const {
        subscriptions,
        loading: subscriptionsLoading,
        subscribeToUserSubscriptions,
        refreshSubscriptions,
    } = useSubscriptions();

    const [processingPayment, setProcessingPayment] = useState<string | null>(null);
    const [verifyingBooking, setVerifyingBooking] = useState<string | null>(null);
    const [deletingBooking, setDeletingBooking] = useState<string | null>(null);
    const [cancellingSubscription, setCancellingSubscription] = useState<string | null>(null);
    const [completingSubscriptionPayment, setCompletingSubscriptionPayment] = useState<string | null>(null);
    const [verifyingSubscriptionId, setVerifyingSubscriptionId] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const needsProfileCompletion = !user?.phone || !user?.location;

    // Subscribe to user's bookings when screen mounts or user changes
    useEffect(() => {
        if (!user?.id) return;
        const unsubscribe = subscribeToUserBookings(user.id);
        return () => { unsubscribe?.(); };
    }, [user?.id, subscribeToUserBookings]);

    // Subscribe to user's Paystack subscriptions (status from webhook)
    useEffect(() => {
        if (!user?.id) return;
        const unsubscribe = subscribeToUserSubscriptions(user.id);
        return () => { unsubscribe?.(); };
    }, [user?.id, subscribeToUserSubscriptions]);

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

    const handlePullToRefresh = useCallback(async () => {
        setRefreshing(true);
        refreshBookings();
        refreshSubscriptions();
        setTimeout(() => setRefreshing(false), 500);
    }, [refreshBookings, refreshSubscriptions]);

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

                // Subscription booking (MoMo): use subscription payment URL so webhook activates subscription
                const subscriptionIdForBooking =
                    booking.type === 'subscription' && booking.subscriptionId != null && booking.subscriptionId !== ''
                        ? String(booking.subscriptionId).trim()
                        : '';
                if (subscriptionIdForBooking) {
                    const { authorizationUrl } = await getSubscriptionPaymentUrl({
                        subscriptionId: subscriptionIdForBooking,
                        reference: booking.payment?.reference,
                    });
                    await Linking.openURL(authorizationUrl);
                    Alert.alert(
                        'Complete payment',
                        'Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed.'
                    );
                    return;
                }

                // If authorizationUrl exists, open it
                if (booking.payment.authorizationUrl) {
                    console.log('[Payment] Opening existing authorization URL');
                    await Linking.openURL(booking.payment.authorizationUrl);
                    Alert.alert(
                        'Complete payment',
                        'Please complete your payment in the opened page. Your booking will update automatically once payment is confirmed via webhook.'
                    );
                } else {
                    // Otherwise, initialize new payment for SAME booking (requires bookingId)
                    const bookingId = booking?.id != null ? String(booking.id).trim() : '';
                    if (!bookingId) {
                        Alert.alert('Error', 'Booking ID is missing. Please refresh and try again.');
                        return;
                    }
                    console.log('[Payment] Initializing new payment for existing booking');
                    const { authorizationUrl } = await initiatePaymentForBooking(bookingId);
                    await Linking.openURL(authorizationUrl);
                    Alert.alert(
                        'Complete payment',
                        'Please complete your payment in the opened page. Your booking will update automatically once payment is confirmed via webhook.',
                        [{ text: 'OK' }]
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
        [user?.email]
    );

    const handleManualVerify = useCallback(
        async (booking: Booking) => {
            const bookingId = booking?.id != null ? String(booking.id).trim() : '';
            if (!bookingId) {
                Alert.alert('Error', 'Booking ID is missing. Please refresh and try again.');
                return;
            }
            try {
                console.log('[Manual verify] User requested payment verification for booking:', bookingId);
                setVerifyingBooking(booking.id);
                const isAlreadyPaid = await verifyBookingPayment(
                    bookingId,
                    true // throwOnError = true
                );

                if (isAlreadyPaid) {
                    // The onSnapshot listener will automatically update the UI
                    Alert.alert(
                        'Payment Confirmed ✅',
                        'This booking has been paid for. Your booking list will update automatically.',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Payment Not Found',
                        'Payment has not been confirmed yet. This may take a few moments after completing payment. Your booking will update automatically once payment is confirmed.',
                        [{ text: 'OK' }]
                    );
                }
            } catch (verifyError: any) {
                console.warn('[Manual verify] Verification failed:', verifyError.message);

                if (verifyError.message.includes('Network') || verifyError.message.includes('non-JSON')) {
                    Alert.alert(
                        'Connection Error',
                        'Could not verify payment status. Please check your internet connection and try again.',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Verification Error',
                        verifyError.message || 'Could not verify payment status. Please try again or contact support.',
                        [{ text: 'OK' }]
                    );
                }
            } finally {
                setVerifyingBooking(null);
            }
        },
        []
    );

    const handleDeleteBooking = useCallback(
        (booking: Booking) => {
            // Show confirmation dialog
            Alert.alert(
                'Delete booking?',
                'This will remove this booking permanently. You can create a new one anytime.',
                [
                    {
                        text: 'Cancel',
                        style: 'cancel',
                    },
                    {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                            try {
                                console.log('[Delete] User confirmed deletion for booking:', booking.id);
                                setDeletingBooking(booking.id);

                                // Delete from Firestore
                                await deleteBooking(booking.id);

                                // Optimistically remove from UI
                                // The onSnapshot listener will also remove it, but this makes it feel faster
                                removeBookingOptimistically(booking.id);

                                console.log('[Delete] ✅ Booking deleted successfully');
                            } catch (deleteError: any) {
                                console.error('[Delete] ❌ Deletion failed:', deleteError);

                                // Show appropriate error message
                                if (deleteError.message?.includes('Paid bookings cannot be deleted')) {
                                    Alert.alert(
                                        'Cannot Delete',
                                        'Paid bookings cannot be deleted. Please contact support if you need assistance.',
                                        [{ text: 'OK' }]
                                    );
                                } else {
                                    Alert.alert(
                                        'Delete Failed',
                                        deleteError.message || 'Could not delete booking. Please try again.',
                                        [{ text: 'OK' }]
                                    );
                                }
                            } finally {
                                setDeletingBooking(null);
                            }
                        },
                    },
                ],
                { cancelable: true }
            );
        },
        [removeBookingOptimistically]
    );

    const handleCancelSubscription = useCallback((sub: Subscription) => {
        const subscriptionId = sub?.id != null ? String(sub.id).trim() : '';
        if (!subscriptionId) {
            Alert.alert('Error', 'Subscription ID is missing. Please refresh and try again.');
            return;
        }

        console.log('[Cancel subscription] Subscription:', sub.id);
        
        const isPending = sub.status === 'pending';
        Alert.alert(
            isPending ? 'Cancel pending subscription?' : 'Cancel subscription?',
            isPending
                ? 'This will cancel your pending subscription. You can start a new one anytime.'
                : 'Your recurring pickups will stop after cancellation. You can start a new subscription anytime.',
            [
                { text: 'Keep', style: 'cancel' },
                {
                    text: 'Cancel subscription',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCancellingSubscription(sub.id);
                            await cancelSubscription({
                                subscriptionId,
                                reference: sub.payment?.reference ?? sub.reference,
                            });
                            refreshSubscriptions();
                            Alert.alert(
                                'Subscription cancelled',
                                'Your subscription has been cancelled. Status will update shortly.',
                                [{ text: 'OK' }]
                            );
                        } catch (err: any) {
                            Alert.alert(
                                'Error',
                                err?.message ?? 'Could not cancel subscription. Please try again.'
                            );
                        } finally {
                            setCancellingSubscription(null);
                        }
                    },
                },
            ]
        );
    }, [refreshSubscriptions]);

    const handleVerifySubscriptionPayment = useCallback(
        async (sub: Subscription) => {
            const reference = sub.payment?.reference ?? sub.reference;
            if (!reference) {
                Alert.alert('No reference', 'No payment reference to verify. Please complete or retry payment first.');
                return;
            }
            try {
                setVerifyingSubscriptionId(sub.id);
                const result = await verifyPaymentByReference(reference);
                refreshSubscriptions();
                if (result.paid) {
                    Alert.alert(
                        'Payment confirmed',
                        'Your subscription payment has been confirmed. Status will update shortly.',
                        [{ text: 'OK' }]
                    );
                } else {
                    Alert.alert(
                        'Payment not confirmed',
                        'Payment has not been confirmed yet. Complete payment in the browser and tap Verify again, or wait for the page to update automatically.',
                        [{ text: 'OK' }]
                    );
                }
            } catch (err: any) {
                Alert.alert(
                    'Verification failed',
                    err?.message?.includes('Network') || err?.message?.includes('non-JSON')
                        ? 'Could not verify. Check your connection and try again.'
                        : err?.message ?? 'Could not verify payment. Please try again.'
                );
            } finally {
                setVerifyingSubscriptionId(null);
            }
        },
        [refreshSubscriptions]
    );

    const handleCompleteSubscriptionPayment = useCallback(
        async (sub: Subscription) => {
            const subscriptionId = sub?.id != null ? String(sub.id).trim() : '';
            if (!subscriptionId) {
                Alert.alert('Error', 'Subscription ID is missing. Please refresh and try again.');
                return;
            }
            try {
                setCompletingSubscriptionPayment(sub.id);
                const { authorizationUrl } = await getSubscriptionPaymentUrl({
                    subscriptionId,
                    reference: sub.payment?.reference ?? sub.reference,
                });
                await Linking.openURL(authorizationUrl);
                Alert.alert(
                    'Complete payment',
                    'Please complete your subscription payment in the opened page. Status will update automatically once payment is confirmed.'
                );
            } catch (err: any) {
                Alert.alert(
                    'Payment error',
                    err?.message ?? 'Could not start payment. Please try again.'
                );
            } finally {
                setCompletingSubscriptionPayment(null);
            }
        },
        []
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
        <ScrollView
            style={styles.content}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={handlePullToRefresh}
                    tintColor={COLORS.primary}
                    colors={[COLORS.primary]}
                />
            }
        >
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

            {/* Subscription section: loading, empty, or cards */}
            <View style={styles.subscriptionSection}>
                <AppText style={styles.subscriptionSectionTitle}>My subscription</AppText>
                {subscriptionsLoading ? (
                    <View style={styles.subscriptionCard}>
                        <View style={styles.subscriptionLoadingRow}>
                            <ActivityIndicator size="small" color={COLORS.primary} />
                            <AppText style={styles.subscriptionLoadingText}>Loading subscription...</AppText>
                        </View>
                    </View>
                ) : subscriptions.length === 0 ? (
                    <View style={styles.subscriptionEmptyCard}>
                        <AppText style={styles.subscriptionEmptyTitle}>
                            Subscribe to weekly waste collection
                        </AppText>
                        <AppText style={styles.subscriptionEmptySubtitle}>
                            Get regular pickups and never miss a collection day.
                        </AppText>
                        <TouchableOpacity
                            style={styles.subscriptionEmptyCta}
                            onPress={() => {
                                trackEvent('activation_started', { screen: SCREEN, source: 'subscription_empty' });
                                navigation.navigate('NewBooking');
                            }}
                        >
                            <AppText style={styles.subscriptionEmptyCtaText}>Create subscription</AppText>
                        </TouchableOpacity>
                    </View>
                ) : (
                    subscriptions.map((sub) => {
                        const paymentStatus = sub.payment?.status ?? 'none';
                        const isPaid = paymentStatus === 'paid';
                        const needsPayment = !isPaid;
                        const isProcessing = completingSubscriptionPayment === sub.id;
                        const isVerifying = verifyingSubscriptionId === sub.id;
                        const isCancelling = cancellingSubscription === sub.id;
                        const canCancel = sub.status === 'active' || sub.status === 'pending';
                        return (
                            <View key={sub.id} style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <AppText style={styles.cardDate}>
                                        {sub.interval === 'monthly' ? 'Monthly' : 'Weekly'} Collection
                                    </AppText>
                                    {canCancel && (
                                        <TouchableOpacity
                                            style={styles.deleteIconButton}
                                            onPress={() => handleCancelSubscription(sub)}
                                            disabled={isProcessing || isCancelling || isVerifying}
                                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                        >
                                            {isCancelling ? (
                                                <ActivityIndicator size="small" color={COLORS.error} />
                                            ) : (
                                                <AppText style={styles.deleteIcon}>✕</AppText>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <AppText style={styles.cardWindow}>
                                    Collection day: {(sub.collectionDayOfWeek ?? '—').replace(/^\w/, (c) => c.toUpperCase())}
                                </AppText>
                                <AppText style={styles.cardLocation}>
                                    Amount: {sub.amount != null ? formatPrice(sub.amount) : '—'}
                                </AppText>
                                <AppText style={styles.cardSummary}>
                                    Next payment: {formatSubscriptionDate(sub.nextChargeDate)}
                                </AppText>
                                <AppText style={styles.cardTotal}>
                                    Total: {sub.amount != null ? formatPrice(sub.amount) : '—'}
                                </AppText>

                                <View style={styles.statusRow}>
                                    <View
                                        style={[
                                            styles.statusBadge,
                                            { backgroundColor: getSubscriptionStatusColor(sub.status) },
                                        ]}
                                    >
                                        <AppText style={styles.statusText}>
                                            {getSubscriptionStatusLabel(sub.status).toUpperCase()}
                                        </AppText>
                                    </View>
                                    {isPaid ? (
                                        <View
                                            style={[
                                                styles.paymentStatusBadge,
                                                { backgroundColor: COLORS.success },
                                            ]}
                                        >
                                            <AppText style={styles.paymentStatusText}>✓ PAID</AppText>
                                        </View>
                                    ) : isVerifying ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator size="small" color={COLORS.primary} />
                                            <AppText style={{ fontSize: 12, color: COLORS.textSecondary }}>
                                                Verifying payment...
                                            </AppText>
                                        </View>
                                    ) : (
                                        <View
                                            style={[
                                                styles.paymentStatusBadge,
                                                {
                                                    backgroundColor:
                                                        paymentStatus === 'initiated' ? '#FFA500' : '#FF6B6B',
                                                },
                                            ]}
                                        >
                                            <AppText style={styles.paymentStatusText}>
                                                {paymentStatus === 'initiated'
                                                    ? '⚠ PAYMENT PENDING'
                                                    : '❌ PAYMENT REQUIRED'}
                                            </AppText>
                                        </View>
                                    )}
                                </View>

                                {needsPayment && !isVerifying && (
                                    <View style={styles.paymentActionsRow}>
                                        <TouchableOpacity
                                            style={[styles.retryPaymentButton, styles.retryPaymentButtonWithVerify]}
                                            onPress={() => handleCompleteSubscriptionPayment(sub)}
                                            disabled={isCancelling}
                                        >
                                            {isProcessing ? (
                                                <ActivityIndicator size="small" color="#fff" />
                                            ) : (
                                                <AppText style={styles.retryPaymentButtonText}>
                                                    Retry payment
                                                </AppText>
                                            )}
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.verifyPaymentButton}
                                            onPress={() => handleVerifySubscriptionPayment(sub)}
                                            disabled={isProcessing || isCancelling}
                                        >
                                            <AppText style={styles.verifyPaymentButtonText}>
                                                Verify payment
                                            </AppText>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        );
                    })
                )}
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
                        onPress={handlePullToRefresh}
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
                    const isVerifying = verifyingBooking === booking.id;
                    const isDeleting = deletingBooking === booking.id;
                    const canDelete = !isPaid && (booking.payment.status === "unpaid" || booking.payment.status === "initiated");

                    return (
                        <View key={booking.id} style={styles.card}>
                            <View style={styles.cardHeader}>
                                <AppText style={styles.cardDate}>
                                    {formatDate(booking.date)}
                                </AppText>

                                {/* Delete Icon - Only show for unpaid bookings */}
                                {canDelete && (
                                    <TouchableOpacity
                                        style={styles.deleteIconButton}
                                        onPress={() => handleDeleteBooking(booking)}
                                        disabled={isProcessing || isDeleting || isVerifying}
                                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                    >
                                        {isDeleting ? (
                                            <ActivityIndicator size="small" color={COLORS.error} />
                                        ) : (
                                            <AppText style={styles.deleteIcon}>✕</AppText>
                                        )}
                                    </TouchableOpacity>
                                )}
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

                            {/* Status Row: Booking Status + Payment Status */}
                            <View style={styles.statusRow}>
                                {/* Booking Status Badge */}
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

                                {/* Payment Status Badge */}
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
                                            Verifying payment...
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

                                {/* Subscription Badge (optional) */}
                                {booking.type === "subscription" && (
                                    <View style={[styles.statusBadge, { backgroundColor: COLORS.primary }]}>
                                        <AppText style={styles.statusText}>
                                            SUBSCRIPTION
                                        </AppText>
                                    </View>
                                )}
                            </View>

                            {/* Payment Action Buttons - same as subscription cards: always Retry + Verify when unpaid */}
                            {needsPayment && !isVerifying && (
                                <View style={styles.paymentActionsRow}>
                                    <TouchableOpacity
                                        style={[styles.retryPaymentButton, styles.retryPaymentButtonWithVerify]}
                                        onPress={() => handleContinuePayment(booking)}
                                        disabled={isProcessing || isDeleting}
                                    >
                                        {isProcessing ? (
                                            <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                            <AppText style={styles.retryPaymentButtonText}>
                                                Retry payment
                                            </AppText>
                                        )}
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.verifyPaymentButton}
                                        onPress={() => handleManualVerify(booking)}
                                        disabled={isProcessing || isDeleting}
                                    >
                                        <AppText style={styles.verifyPaymentButtonText}>
                                            Verify payment
                                        </AppText>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    );
                })
            )}
        </ScrollView>
    );
};

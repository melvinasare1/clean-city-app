import React, { useCallback, useLayoutEffect, useMemo, useState, useEffect } from 'react';
import {
    ActionSheetIOS,
    ActivityIndicator,
    Alert,
    Linking,
    Platform,
    RefreshControl,
    ScrollView,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import {
    CustomerStackParamList,
    CustomerTabParamList,
} from '@/navigation/types';
import {
    getUnifiedStatusForBooking,
    getUnifiedStatusForSubscription,
    getUnifiedStatusLabel,
    isInactiveDetailStatus,
} from '@/lib/booking-display-status';
import { COLORS } from '@/lib/constants';
import { styles } from './my-bookings-screen.styles';
import {
    formatDate,
    getMyBookingsListPillColors,
    getOneTimeBookingListTitle,
    getOneTimeListDateLine,
    getOneTimeListStatusDisplay,
    getSubscriptionCollectionLabel,
    getSubscriptionListMetaLine,
    SCREEN,
} from './my-bookings-screen.utils';
import {
    getNextPickupIsoForBooking,
    getNextPickupIsoForSubscription,
} from '../booking-detail/booking-detail-screen.utils';
import { trackEvent } from '@/services/analytics';
import { openDeleteAccountSupport } from '@/lib/delete-account';
import { useBookings } from '@/contexts/bookings-context';
import { useSubscriptions } from '@/contexts/subscriptions-context';

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
    } = useBookings();
    const {
        subscriptions,
        loading: subscriptionsLoading,
        refreshSubscriptions,
    } = useSubscriptions();

    const [refreshing, setRefreshing] = useState(false);

    const oneTimeBookings = useMemo(
        () => bookings.filter((b) => b.type === 'one_off'),
        [bookings]
    );

    const needsProfileCompletion = !user?.phone || !user?.location;

    useEffect(() => {
        if (!user?.id) return;
        const unsubscribe = subscribeToUserBookings(user.id);
        return () => { unsubscribe?.(); };
    }, [user?.id, subscribeToUserBookings]);

    const handleActionSelection = useCallback(
        async (index: number) => {
            if (index === 0) {
                Linking.openURL('mailto:support@cleancitygh.com').catch((err) =>
                    console.warn('Failed to open mail client', err)
                );
            } else if (index === 1) {
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
            } else if (index === 3) {
                try {
                    await openDeleteAccountSupport(user?.id, logout);
                    await trackEvent('logout', { screen: 'settings', reason: 'delete_account' });
                } catch (err) {
                    console.error('Error during delete account:', err);
                    Alert.alert(
                        'Something went wrong',
                        'We could not complete your request. Please try again.'
                    );
                }
            }
        },
        [logout, user?.id]
    );

    const showOptionsSheet = useCallback(() => {
        const options = ['Leave feedback', 'Get support', 'Log out', 'Delete account', 'Cancel'];
        const destructiveButtonIndex = 3;
        const cancelButtonIndex = 4;

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
                        onPress: () => handleActionSelection(2),
                    },
                    {
                        text: 'Delete account',
                        style: 'destructive',
                        onPress: () => handleActionSelection(3),
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

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: 'My Bookings',
            headerTitleAlign: 'center',
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

    const openSubscriptionDetail = useCallback(
        (subscriptionId: string) => {
            navigation.navigate('BookingDetail', { kind: 'subscription', id: subscriptionId });
        },
        [navigation]
    );

    const openBookingDetail = useCallback(
        (bookingId: string) => {
            navigation.navigate('BookingDetail', { kind: 'booking', id: bookingId });
        },
        [navigation]
    );

    return (
        <ScrollView
            style={styles.scrollRoot}
            contentContainerStyle={styles.scrollInner}
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

            <View style={styles.pageHeaderBlock}>
                <AppText style={styles.dashboardTitle}>Booking Dashboard</AppText>
                <AppText style={styles.dashboardSubtitle}>
                    Manage and track your environmental services in one place.
                </AppText>
            </View>

            <View style={[styles.sectionBlock, styles.sectionBlockFirst]}>
                <AppText style={styles.sectionCapsLabel}>SUBSCRIPTIONS</AppText>
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
                        const unified = getUnifiedStatusForSubscription(sub);
                        const inactive = isInactiveDetailStatus(unified);
                        const pill = getMyBookingsListPillColors(unified);
                        const nextIso = getNextPickupIsoForSubscription(sub, bookings);
                        const nextLabel = nextIso ? formatDate(nextIso) : null;
                        const meta = getSubscriptionListMetaLine(sub, unified, nextLabel);
                        return (
                            <TouchableOpacity
                                key={sub.id}
                                style={styles.card}
                                onPress={() => openSubscriptionDetail(sub.id)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.bookingCardTouchable}>
                                    <View style={styles.bookingCardMain}>
                                        <View style={styles.bookingCardTitleRow}>
                                            <AppText
                                                style={[
                                                    styles.bookingCardType,
                                                    inactive && styles.bookingCardTitleMuted,
                                                ]}
                                                numberOfLines={2}
                                            >
                                                {getSubscriptionCollectionLabel(sub)}
                                            </AppText>
                                            <View
                                                style={[
                                                    styles.bookingListStatusBadge,
                                                    { backgroundColor: pill.backgroundColor },
                                                ]}
                                            >
                                                <AppText
                                                    style={[
                                                        styles.bookingListStatusText,
                                                        { color: pill.color },
                                                    ]}
                                                >
                                                    {getUnifiedStatusLabel(unified).toUpperCase()}
                                                </AppText>
                                            </View>
                                        </View>
                                        {meta ? (
                                            <View style={styles.bookingCardMetaRow}>
                                                <Ionicons
                                                    name={
                                                        meta.kind === 'ended'
                                                            ? 'calendar-clear-outline'
                                                            : 'calendar-outline'
                                                    }
                                                    size={15}
                                                    color={COLORS.textSecondary}
                                                />
                                                <AppText style={styles.bookingCardNext}>{meta.text}</AppText>
                                            </View>
                                        ) : null}
                                    </View>
                                    <AppText style={styles.bookingCardChevron}>›</AppText>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>

            <View style={styles.sectionBlock}>
                <View style={styles.sectionHeaderRow}>
                    <AppText style={[styles.sectionCapsLabel, styles.sectionCapsLabelInline]}>
                        ONE-TIME SERVICES
                    </AppText>
                    <TouchableOpacity
                        style={styles.schedulePill}
                        onPress={() => {
                            trackEvent('activation_started', {
                                screen: SCREEN,
                                source: 'one_time_section_schedule',
                            });
                            navigation.navigate('NewBooking');
                        }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <AppText style={styles.schedulePillText}>+ Schedule</AppText>
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
                            onPress={handlePullToRefresh}
                        >
                            <AppText style={styles.retryButtonText}>Try again</AppText>
                        </TouchableOpacity>
                    </View>
                ) : oneTimeBookings.length === 0 ? (
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
                    oneTimeBookings.map((booking) => {
                        const unified = getUnifiedStatusForBooking(booking);
                        const inactive = isInactiveDetailStatus(unified);
                        const statusDisp = getOneTimeListStatusDisplay(unified);
                        const dateLine = getOneTimeListDateLine(booking, unified);
                        return (
                            <TouchableOpacity
                                key={booking.id}
                                style={styles.card}
                                onPress={() => openBookingDetail(booking.id)}
                                activeOpacity={0.75}
                            >
                                <View style={styles.bookingCardTouchable}>
                                    <View style={styles.bookingCardMain}>
                                        <AppText
                                            style={[
                                                styles.bookingCardType,
                                                inactive && styles.bookingCardTitleMuted,
                                            ]}
                                            numberOfLines={2}
                                        >
                                            {getOneTimeBookingListTitle(booking)}
                                        </AppText>
                                        <AppText
                                            style={[styles.oneTimeStatusCaps, { color: statusDisp.color }]}
                                        >
                                            {statusDisp.text}
                                        </AppText>
                                        <View style={styles.bookingCardMetaRow}>
                                            <Ionicons
                                                name="calendar-outline"
                                                size={15}
                                                color={COLORS.textSecondary}
                                            />
                                            <AppText style={styles.bookingCardNext}>{dateLine}</AppText>
                                        </View>
                                    </View>
                                    <AppText style={styles.bookingCardChevron}>›</AppText>
                                </View>
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>
        </ScrollView>
    );
};

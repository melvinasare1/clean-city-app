import React, { useEffect, useMemo } from 'react';
import {
  View,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, ResponsiveContent } from '@/components';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { styles } from './customer-home-screen.styles';
import {
  CustomerStackParamList,
  CustomerTabParamList,
} from '@/navigation/types';
import type { BookingBinItem } from '@platform/shared-types';
import { trackEvent } from '@/services/analytics';
import { COLORS } from '@/lib/constants';
import {
  getProfileCompletionCount,
  isProfileComplete,
} from '@/lib/referral-utils';
import { useBookings } from '@/contexts/bookings-context';
import { useSubscriptions } from '@/contexts/subscriptions-context';
import {
  PROFILE_STEPS_TOTAL,
  getGreetingName,
  getInitials,
  getLastReorderableBooking,
  getNextCollection,
} from './customer-home-screen.utils';

type CustomerHomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'CustomerHome'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const SCREEN = 'customer_home';
const HERO_IMAGE = require('../../../../assets/images/home-hero-pickup.png');

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();
  const { bookings, subscribeToUserBookings } = useBookings();
  const { subscriptions } = useSubscriptions();

  useEffect(() => {
    if (!user?.id) return;
    const unsubscribe = subscribeToUserBookings(user.id);
    return () => {
      unsubscribe?.();
    };
  }, [user?.id, subscribeToUserBookings]);

  const profileComplete = isProfileComplete(user ?? {});

  const completedSteps = useMemo(
    () =>
      getProfileCompletionCount({
        email: user?.email,
        name: user?.name,
        phone: user?.phone,
        address: user?.address,
      }),
    [user?.email, user?.name, user?.phone, user?.address]
  );

  const progressRatio = completedSteps / PROFILE_STEPS_TOTAL;
  const greetingName = getGreetingName(user?.name);
  const nextCollection = useMemo(
    () => getNextCollection(bookings, subscriptions),
    [bookings, subscriptions]
  );
  const lastBooking = useMemo(
    () => getLastReorderableBooking(bookings),
    [bookings]
  );
  const canReorder = profileComplete && !!lastBooking;

  const navigateToCompleteProfile = () => {
    navigation.navigate('CompleteProfile');
  };

  const openNewBooking = (prefillItems?: BookingBinItem[]) => {
    if (!profileComplete) {
      navigateToCompleteProfile();
      return;
    }
    trackEvent('activation_started', {
      screen: SCREEN,
      source: prefillItems?.length ? 'reorder_last_pickup' : 'book_pickup_card',
    });
    navigation.navigate('NewBooking', {
      prefillItems: prefillItems ?? [],
      nonce: Date.now(),
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent innerStyle={styles.content}>
          <View style={styles.headerRow}>
            <AppText style={styles.greeting} numberOfLines={1}>
              {greetingName ? `Hello, ${greetingName}` : 'Hello!'}
            </AppText>
            <TouchableOpacity
              style={styles.avatarButton}
              onPress={() => navigation.navigate('CustomerProfile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
            >
              <AppText style={styles.avatarInitials}>
                {getInitials(user?.name)}
              </AppText>
            </TouchableOpacity>
          </View>

          {user?.address ? (
            <View style={styles.locationPill}>
              <Ionicons
                name="location-outline"
                size={16}
                color={COLORS.primary}
              />
              <AppText style={styles.locationText} numberOfLines={1}>
                {user.address}
              </AppText>
            </View>
          ) : null}

          {!profileComplete ? (
            <TouchableOpacity
              style={styles.profileBanner}
              onPress={navigateToCompleteProfile}
              activeOpacity={0.85}
            >
              <View style={styles.profileBannerRow}>
                <View style={styles.profileBannerIcon}>
                  <Ionicons name="person" size={22} color={COLORS.white} />
                </View>
                <View style={styles.profileBannerTextCol}>
                  <AppText style={styles.profileBannerTitle}>
                    Complete your profile
                  </AppText>
                  <AppText style={styles.profileBannerSubtitle}>
                    Add your name, phone and location to start booking pickups
                  </AppText>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.profileProgressRow}>
                <AppText style={styles.profileProgressLabel}>
                  {completedSteps} of {PROFILE_STEPS_TOTAL} steps
                </AppText>
              </View>
              <View style={styles.profileProgressBarBg}>
                <View
                  style={[
                    styles.profileProgressBarFill,
                    { width: `${progressRatio * 100}%` },
                  ]}
                />
              </View>
            </TouchableOpacity>
          ) : null}

          <View style={styles.bookCard}>
            {profileComplete ? (
              <Image
                source={HERO_IMAGE}
                style={styles.heroImage}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : null}
            <View style={styles.bookCardBody}>
              <View style={styles.bookCardCopy}>
                <AppText style={styles.bookCardTitle}>Book a Pickup</AppText>
                <AppText style={styles.bookCardSubtitle}>
                  {profileComplete
                    ? 'Schedule a collection at your convenience.'
                    : 'Complete your profile to book'}
                </AppText>
              </View>
              <TouchableOpacity
                style={[
                  styles.bookButton,
                  !profileComplete && styles.bookButtonMuted,
                ]}
                onPress={() => openNewBooking()}
                accessibilityRole="button"
                accessibilityState={{ disabled: !profileComplete }}
              >
                <AppText style={styles.bookButtonText}>Book</AppText>
              </TouchableOpacity>
            </View>
          </View>

          <AppText style={styles.sectionTitle}>Next Collection</AppText>
          <View style={styles.nextCard}>
            {nextCollection ? (
              <View style={styles.nextInner}>
                <View style={styles.nextIconCircle}>
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.nextCopy}>
                  <AppText style={styles.nextHeadline}>
                    {nextCollection.headline}
                  </AppText>
                  <AppText style={styles.nextWaste}>
                    {nextCollection.wasteLabel}
                  </AppText>
                </View>
              </View>
            ) : (
              <View style={styles.nextInner}>
                <View style={styles.nextIconCircle}>
                  <Ionicons
                    name="calendar-outline"
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <View style={styles.nextCopy}>
                  <AppText style={styles.nextHeadline}>
                    No upcoming pickup
                  </AppText>
                  <AppText style={styles.emptyNext}>
                    Book a collection and it will show up here.
                  </AppText>
                </View>
              </View>
            )}
          </View>

          <AppText style={styles.sectionTitle}>Quick Actions</AppText>
          <View style={styles.actionsList}>
            <TouchableOpacity
              style={[styles.actionRow, !canReorder && styles.actionRowDisabled]}
              disabled={!canReorder}
              onPress={() => {
                if (!lastBooking) return;
                openNewBooking(lastBooking.items);
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, styles.actionIconTeal]}>
                <Ionicons name="refresh" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.actionLabel}>Reorder last pickup</AppText>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => navigation.navigate('Store')}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, styles.actionIconAmber]}>
                <Ionicons name="bag-handle-outline" size={20} color={COLORS.amberDark} />
              </View>
              <AppText style={styles.actionLabel}>View Our Store</AppText>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => {
                trackEvent('recycling_guide_cta_tapped', { screen: SCREEN }).catch(
                  () => { }
                );
                navigation.navigate('RecyclingGuides');
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.actionIconCircle, styles.actionIconTeal]}>
                <Ionicons name="sync-outline" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.actionLabel}>Learn about recycling</AppText>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};

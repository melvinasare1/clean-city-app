import React, { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
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
import { AppText } from '@/components';
import { trackEvent } from '@/services/analytics';
import { COLORS, REFERRALS_UI_ENABLED } from '@/lib/constants';
import {
  getProfileCompletionCount,
  isProfileComplete,
} from '@/lib/referral-utils';

type CustomerHomeScreenProps = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'CustomerHome'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

const SCREEN = 'customer_home';
const PROFILE_STEPS_TOTAL = 3;

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({
  navigation,
}) => {
  const { user } = useAuth();

  const profileComplete = useMemo(
    () => user?.profileComplete ?? isProfileComplete(user ?? {}),
    [user]
  );

  const completedSteps = useMemo(
    () =>
      getProfileCompletionCount({
        email: user?.email,
        phone: user?.phone,
        location: user?.location,
      }),
    [user?.email, user?.phone, user?.location]
  );

  const progressRatio = completedSteps / PROFILE_STEPS_TOTAL;

  const navigateToCompleteProfile = () => {
    navigation.getParent()?.navigate('CompleteProfile');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText style={styles.title}>Welcome back!</AppText>
        <AppText style={styles.subtitle}>{user?.email}</AppText>
      </View>

      <View style={styles.content}>
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
              <View style={{ flex: 1 }}>
                <AppText style={styles.profileBannerTitle}>
                  Complete your profile
                </AppText>
                <AppText style={styles.profileBannerSubtitle}>
                  Add your phone and location to start booking pickups
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={COLORS.primary} />
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

        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Quick Actions</AppText>

          <TouchableOpacity
            style={[
              styles.actionButton,
              !profileComplete && styles.actionButtonMuted,
            ]}
            onPress={() => {
              if (!profileComplete) {
                navigateToCompleteProfile();
                return;
              }
              trackEvent('activation_started', {
                screen: SCREEN,
                source: 'quick_action_button',
              });
              navigation.navigate('NewBooking');
            }}
          >
            <AppText style={styles.actionButtonText}>Book pickup</AppText>
            {!profileComplete ? (
              <AppText style={styles.actionButtonHint}>
                Complete your profile to book
              </AppText>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <AppText style={styles.actionButtonTextSecondary}>
              My pickups
            </AppText>
          </TouchableOpacity>

          {REFERRALS_UI_ENABLED ? (
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSecondary]}
              onPress={() => {
                trackEvent('referral_cta_tapped', { screen: SCREEN }).catch(() => {});
                navigation.getParent()?.navigate('ReferralProgram');
              }}
            >
              <AppText style={styles.actionButtonTextSecondary}>
                Refer & Earn Free Pickups
              </AppText>
            </TouchableOpacity>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.recyclingGuideCard}
          onPress={() => {
            trackEvent('recycling_guide_cta_tapped', { screen: SCREEN }).catch(() => {});
            navigation.getParent()?.navigate('RecyclingGuides');
          }}
        >
          <View style={styles.recyclingGuideContent}>
            <View style={styles.recyclingGuideTextContainer}>
              <AppText style={styles.recyclingGuideTitle}>
                Learn about recycling
              </AppText>
              <AppText style={styles.recyclingGuideSubtitle}>
                Simple guides to help you recycle better
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={24} color={COLORS.primary} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

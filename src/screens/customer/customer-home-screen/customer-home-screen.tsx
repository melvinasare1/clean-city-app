import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../hooks/useAuth';
import { styles } from './customer-home-screen.styles';
import { CustomerTabParamList } from '@/navigation/types';
import { AppText } from '@/components';
import { trackEvent } from '@/services/analytics';
import { COLORS } from '@/lib/constants';

type CustomerHomeScreenProps = BottomTabScreenProps<
  CustomerTabParamList,
  'CustomerHome'
>;

const SCREEN = 'customer_home';

export const CustomerHomeScreen: React.FC<CustomerHomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText style={styles.title}>Welcome back!</AppText>
        <AppText style={styles.subtitle}>{user?.email}</AppText>
      </View>

      <View style={styles.content}>
        <View style={styles.card}>
          <AppText style={styles.cardTitle}>Quick Actions</AppText>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              trackEvent('activation_started', {
                screen: SCREEN,
                source: 'quick_action_button',
              });
              navigation.navigate('NewBooking');
            }}
          >
            <AppText style={styles.actionButtonText}>📦 Schedule New Pickup</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <AppText style={styles.actionButtonTextSecondary}>📋 View My Bookings</AppText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={() => {
              trackEvent('referral_cta_tapped', {
                screen: SCREEN,
              }).catch(() => {});
              // Navigate into the customer stack ReferralProgram screen
              navigation.navigate('CustomerTabs'); // ensure we are on tabs
              // Then push the referral screen from stack
              // @ts-ignore - root navigator handled in parent
              navigation.getParent()?.navigate('ReferralProgram');
            }}
          >
            <AppText style={styles.actionButtonTextSecondary}>🌿 Refer & Earn Free Pickups</AppText>
          </TouchableOpacity>
        </View>

        {/* <View style={styles.card}>
          <AppText style={styles.cardTitle}>Recent Activity</AppText>
          <AppText style={styles.placeholderText}>
            Your recent bookings will appear here
          </AppText>
        </View> */}

        <TouchableOpacity
          style={styles.recyclingGuideCard}
          onPress={() => {
            trackEvent('recycling_guide_cta_tapped', {
              screen: SCREEN,
            }).catch(() => {});
            // @ts-ignore - root navigator handled in parent
            navigation.getParent()?.navigate('RecyclingGuides');
          }}
        >
          <View style={styles.recyclingGuideContent}>
            <View style={styles.recyclingGuideTextContainer}>
              <AppText style={styles.recyclingGuideTitle}>Learn about recycling</AppText>
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

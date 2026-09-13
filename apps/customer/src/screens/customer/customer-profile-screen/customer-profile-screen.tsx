import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  ScrollView,
  Switch,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { CompositeScreenProps } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AppText, ResponsiveContent } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import { openDeleteAccountSupport } from '@/lib/delete-account';
import { setDocAtPath } from '@/lib/utils';
import { isProfileComplete } from '@/lib/referral-utils';
import { trackEvent } from '@/services/analytics';
import {
  CustomerStackParamList,
  CustomerTabParamList,
} from '@/navigation/types';
import { getInitials } from '../customer-home-screen/customer-home-screen.utils';
import { styles } from './customer-profile-screen.styles';

type Props = CompositeScreenProps<
  BottomTabScreenProps<CustomerTabParamList, 'CustomerProfile'>,
  NativeStackScreenProps<CustomerStackParamList>
>;

export const CustomerProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout, refreshUserProfile } = useAuth();
  const profileComplete = isProfileComplete(user ?? {});
  const [remindersEnabled, setRemindersEnabled] = useState(
    user?.bookingRemindersEnabled !== false
  );
  const [promotionsEnabled, setPromotionsEnabled] = useState(
    user?.promotionsEnabled === true
  );

  useEffect(() => {
    setRemindersEnabled(user?.bookingRemindersEnabled !== false);
    setPromotionsEnabled(user?.promotionsEnabled === true);
  }, [user?.bookingRemindersEnabled, user?.promotionsEnabled]);

  const persistPreference = useCallback(
    async (
      field: 'bookingRemindersEnabled' | 'promotionsEnabled',
      value: boolean
    ) => {
      if (!user?.id) return;
      const payload: Record<string, unknown> = { [field]: value };
      if (field === 'bookingRemindersEnabled') {
        payload.notificationPreferences = { enabled: value };
      }
      await setDocAtPath(['profiles', user.id], payload, {
        merge: true,
        addTimestamps: true,
      });
      await refreshUserProfile();
    },
    [refreshUserProfile, user?.id]
  );

  const handleRemindersToggle = useCallback(
    async (value: boolean) => {
      const previous = remindersEnabled;
      setRemindersEnabled(value);
      try {
        await persistPreference('bookingRemindersEnabled', value);
      } catch (err) {
        console.error('Error updating booking reminders:', err);
        setRemindersEnabled(previous);
        Alert.alert(
          'Could not update',
          'We could not save your reminder preference. Please try again.'
        );
      }
    },
    [persistPreference, remindersEnabled]
  );

  const handlePromotionsToggle = useCallback(
    async (value: boolean) => {
      const previous = promotionsEnabled;
      setPromotionsEnabled(value);
      try {
        await persistPreference('promotionsEnabled', value);
      } catch (err) {
        console.error('Error updating promotions preference:', err);
        setPromotionsEnabled(previous);
        Alert.alert(
          'Could not update',
          'We could not save your promotions preference. Please try again.'
        );
      }
    },
    [persistPreference, promotionsEnabled]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      await trackEvent('logout', { screen: 'profile' });
    } catch (err) {
      console.error('Error during logout:', err);
      Alert.alert('Logout failed', 'We could not log you out. Please try again.');
    }
  }, [logout]);

  const handleDelete = useCallback(async () => {
    try {
      await openDeleteAccountSupport(user?.id, logout);
      await trackEvent('logout', { screen: 'profile', reason: 'delete_account' });
    } catch (err) {
      console.error('Error during delete account:', err);
      Alert.alert(
        'Something went wrong',
        'We could not complete your request. Please try again.'
      );
    }
  }, [logout, user?.id]);

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: handleLogout },
    ]);
  };

  const confirmDelete = () => {
    Alert.alert(
      'Delete account',
      'This will open WhatsApp so support can help you delete your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: handleDelete },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <ResponsiveContent>
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.headerBack}
              onPress={() => navigation.navigate('CustomerHome')}
              accessibilityRole="button"
              accessibilityLabel="Back to home"
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <AppText style={styles.headerTitle}>Profile</AppText>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.identityCard}>
            <View style={styles.avatar}>
              <AppText style={styles.avatarInitials}>
                {getInitials(user?.name)}
              </AppText>
            </View>
            <View style={styles.identityCopy}>
              <AppText style={styles.name} numberOfLines={1}>
                {user?.name?.trim() || 'Complete your profile'}
              </AppText>
              <AppText style={styles.phone} numberOfLines={1}>
                {user?.phone?.trim() || 'No phone added'}
              </AppText>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('CompleteProfile')}
              accessibilityRole="button"
              accessibilityLabel={
                profileComplete ? 'Edit profile' : 'Complete your profile'
              }
              hitSlop={8}
            >
              <AppText style={styles.editLink}>Edit</AppText>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Account</AppText>
            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowBorder]}
              onPress={() => navigation.navigate('CompleteProfile')}
              accessibilityRole="button"
              accessibilityLabel="Edit pickup address"
            >
              <View style={styles.iconWrap}>
                <Ionicons name="location" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.menuLabel}>Pickup address</AppText>
              {user?.address ? (
                <AppText style={styles.menuValue} numberOfLines={1}>
                  {user.address}
                </AppText>
              ) : null}
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('PaymentMethods')}
              accessibilityRole="button"
              accessibilityLabel="Payment methods"
            >
              <View style={styles.iconWrap}>
                <Ionicons name="card" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.menuLabel}>Payment Methods</AppText>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Preferences</AppText>
            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View style={styles.iconWrap}>
                <Ionicons name="notifications" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.menuLabel}>Booking Reminders</AppText>
              <Switch
                value={remindersEnabled}
                onValueChange={handleRemindersToggle}
                trackColor={{ false: '#d1d5db', true: COLORS.secondary }}
                thumbColor={COLORS.white}
                ios_backgroundColor="#d1d5db"
                accessibilityLabel="Booking reminders"
              />
            </View>
            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View style={styles.iconWrap}>
                <Ionicons name="megaphone" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.menuLabel}>Promotions</AppText>
              <Switch
                value={promotionsEnabled}
                onValueChange={handlePromotionsToggle}
                trackColor={{ false: '#d1d5db', true: COLORS.secondary }}
                thumbColor={COLORS.white}
                ios_backgroundColor="#d1d5db"
                accessibilityLabel="Promotions"
              />
            </View>
            <View style={styles.menuRow}>
              <View style={styles.iconWrap}>
                <Ionicons name="globe-outline" size={20} color={COLORS.primary} />
              </View>
              <AppText style={styles.menuLabel}>Language</AppText>
              <AppText style={styles.menuValue}>English</AppText>
            </View>
          </View>

          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.menuRow, styles.menuRowBorder]}
              onPress={() => navigation.navigate('PrivacyPolicy')}
              accessibilityRole="button"
              accessibilityLabel="Privacy Policy"
            >
              <AppText style={styles.legalLabel}>Privacy Policy</AppText>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={() => navigation.navigate('TermsAndConditions')}
              accessibilityRole="button"
              accessibilityLabel="Terms of Service"
            >
              <AppText style={styles.legalLabel}>Terms of Service</AppText>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <AppText style={styles.sectionTitle}>Account management</AppText>
            <TouchableOpacity
              style={styles.menuRow}
              onPress={confirmDelete}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <View style={styles.iconWrap}>
                <Ionicons name="trash-outline" size={20} color={COLORS.error} />
              </View>
              <AppText style={[styles.menuLabel, styles.destructiveLabel]}>
                Delete account
              </AppText>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={confirmLogout}
            accessibilityRole="button"
            accessibilityLabel="Log out"
          >
            <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            <AppText style={styles.logoutLabel}>Log Out</AppText>
          </TouchableOpacity>
        </ResponsiveContent>
      </ScrollView>
    </SafeAreaView>
  );
};

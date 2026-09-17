import React, { useCallback, useMemo } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@platform/shared-theme';
import { useAuth } from '@/hooks/useAuth';
import { getAppVersionLabel } from '@/lib/app-version';
import { paymentMethodsSubtitle, useDriverProfile } from '@/hooks/useDriverProfile';
import { trackEvent } from '@/services/analytics';
import type { DriverStackParamList, DriverTabParamList } from '@/navigation/types';
import { styles } from './driver-profile-screen.styles';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<DriverTabParamList, 'Profile'>,
    NativeStackNavigationProp<DriverStackParamList>
  >;
};

type ProfileRowProps = {
  icon: React.ComponentProps<typeof Feather>['name'];
  label: string;
  subtitle?: string;
  onPress: () => void;
};

function displayName(name?: string | null, email?: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const fromEmail = email?.split('@')[0];
  return fromEmail || 'Driver';
}

function formatRating(rating: number | null): string {
  if (rating == null) return '—';
  return Number.isInteger(rating) ? String(rating) : rating.toFixed(2);
}

function ProfileRow({ icon, label, subtitle, onPress }: ProfileRowProps) {
  return (
    <Pressable
      style={styles.row}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={colors.inkPrimary} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
    </Pressable>
  );
}

export const DriverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const driverId = user?.id ?? '';
  const profile = useDriverProfile(driverId);

  const name = useMemo(
    () => displayName(profile.name ?? user?.name, user?.email),
    [profile.name, user?.email, user?.name]
  );

  const vehicleLine = useMemo(() => {
    return [profile.vehicleType, profile.vehiclePlate].filter(Boolean).join(' • ');
  }, [profile.vehiclePlate, profile.vehicleType]);

  const paymentSubtitle = paymentMethodsSubtitle(profile.paymentMethods);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      await trackEvent('logout', { screen: 'settings' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your account and preferences</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatarWrap}>
            <View
              style={styles.avatar}
              accessibilityRole="image"
              accessibilityLabel={`${name} avatar`}
            >
              {profile.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.avatarImage} />
              ) : (
                <Feather name="user" size={32} color={colors.inkSecondary} />
              )}
            </View>
          </View>

          <View style={styles.profileCopy}>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.roleLabel}>Delivery Partner</Text>
            {vehicleLine ? <Text style={styles.vehicleLine}>{vehicleLine}</Text> : null}
          </View>

          {profile.status === 'approved' ? (
            <View style={styles.verifiedBadge} accessibilityLabel="Verified">
              <Feather name="check-circle" size={14} color={colors.brandGreen} />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statBlock}>
            <Feather name="star" size={22} color={colors.brandGreen} />
            <View style={styles.statText}>
              <Text style={styles.statValue}>{formatRating(profile.rating)}</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.inkSecondary} />
          </View>
          <View style={styles.statDivider} />
          <Pressable
            style={styles.statBlock}
            onPress={() => navigation.navigate('DriverJobList')}
            accessibilityRole="button"
            accessibilityLabel="Jobs completed"
          >
            <Feather name="briefcase" size={22} color={colors.inkPrimary} />
            <View style={styles.statText}>
              <Text style={styles.statValue}>{profile.jobsCompletedCount}</Text>
              <Text style={styles.statLabel}>Jobs completed</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.inkSecondary} />
          </Pressable>
        </View>

        <View style={styles.list}>
          <ProfileRow
            icon="home"
            label="Service provider"
            subtitle={profile.serviceProviderName ?? '—'}
            onPress={() => navigation.navigate('ServiceProvider')}
          />
          <ProfileRow
            icon="credit-card"
            label="Payment method"
            subtitle={paymentSubtitle}
            onPress={() => navigation.navigate('PaymentMethod')}
          />
          <ProfileRow
            icon="help-circle"
            label="Troubleshooting"
            subtitle="Get help with common issues"
            onPress={() => navigation.navigate('Troubleshooting')}
          />
          <ProfileRow
            icon="camera"
            label="Photo check"
            subtitle="Update and verify your photos"
            onPress={() => navigation.navigate('PhotoCheck')}
          />
          <ProfileRow
            icon="settings"
            label="Settings"
            subtitle="App settings and preferences"
            onPress={() => navigation.navigate('Settings')}
          />
          <ProfileRow
            icon="log-out"
            label="Log out"
            subtitle="Sign out from this device"
            onPress={() => {
              void handleLogout();
            }}
          />
          <View style={styles.row} accessibilityRole="text" accessibilityLabel="App version">
            <View style={styles.rowIcon}>
              <Feather name="info" size={18} color={colors.inkPrimary} />
            </View>
            <View style={styles.rowCopy}>
              <Text style={styles.rowLabel}>App version</Text>
              <Text style={styles.rowSubtitle}>{getAppVersionLabel()}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export const ProfileScreen = DriverProfileScreen;

import React, { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Feather from '@expo/vector-icons/Feather';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '@platform/shared-theme';
import { useAuth } from '@/hooks/useAuth';
import { openDeleteAccountSupport } from '@/lib/delete-account';
import { trackEvent } from '@/services/analytics';
import type { DriverStackParamList, DriverTabParamList } from '@/navigation/types';
import { styles } from './driver-profile-screen.styles';

type Props = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<DriverTabParamList, 'Profile'>,
    NativeStackNavigationProp<DriverStackParamList>
  >;
};

function displayName(name?: string, email?: string): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  const fromEmail = email?.split('@')[0];
  return fromEmail || 'Driver';
}

function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export const DriverProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const name = useMemo(() => displayName(user?.name, user?.email), [user?.email, user?.name]);
  const initials = useMemo(() => initialsFromName(name), [name]);

  const handleLogout = useCallback(async () => {
    try {
      await logout();
      await trackEvent('logout', { screen: 'settings' });
    } catch (error) {
      console.error('Logout error:', error);
    }
  }, [logout]);

  const handleDeleteAccount = useCallback(async () => {
    try {
      await openDeleteAccountSupport(user?.id, logout);
      await trackEvent('logout', { screen: 'settings', reason: 'delete_account' });
    } catch (error) {
      console.error('Delete account error:', error);
    }
  }, [logout, user?.id]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View style={styles.avatar} accessibilityRole="image" accessibilityLabel={`${name} avatar`}>
          <Text style={styles.avatarInitials}>{initials}</Text>
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.name}>{name}</Text>
          {user?.email ? <Text style={styles.email}>{user.email}</Text> : null}
        </View>
      </View>

      <View style={styles.list}>
        <Pressable
          style={styles.row}
          onPress={() => navigation.navigate('DriverJobList')}
          accessibilityRole="button"
          accessibilityLabel="My Jobs"
        >
          <View style={styles.rowIcon}>
            <Feather name="briefcase" size={18} color={colors.inkPrimary} />
          </View>
          <Text style={styles.rowLabel}>My Jobs</Text>
          <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={() => {
            void handleLogout();
          }}
          accessibilityRole="button"
          accessibilityLabel="Logout"
        >
          <View style={styles.rowIcon}>
            <Feather name="log-out" size={18} color={colors.inkPrimary} />
          </View>
          <Text style={styles.rowLabel}>Logout</Text>
          <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
        </Pressable>

        <Pressable
          style={styles.row}
          onPress={() => {
            void handleDeleteAccount();
          }}
          accessibilityRole="button"
          accessibilityLabel="Delete Account"
        >
          <View style={styles.rowIcon}>
            <Feather name="trash-2" size={18} color={colors.signalRed} />
          </View>
          <Text style={[styles.rowLabel, styles.destructiveLabel]}>Delete Account</Text>
          <Feather name="chevron-right" size={18} color={colors.inkSecondary} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, StyleSheet, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { useAuth } from '@/hooks/useAuth';
import { useDriverStatus } from '@/contexts/driver-status-context';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { DriverApprovalBanner } from '@/components/driver/DriverApprovalBanner';
import { TopBar } from '@/components/driver/home/TopBar';
import { MapControls } from '@/components/driver/home/MapControls';
import { HomeSheet } from '@/components/driver/home/HomeSheet';
import { DriverMap } from '@/components/driver/home/DriverMap';
import type { DriverMapHandle } from '@/components/driver/home/driver-map.types';
import { colors } from '@/theme/driver-home';
import { trackEvent } from '@/services/analytics';
import { endShift, startShift, type DriverShift } from '@/services/driver-api';
import { openDeleteAccountSupport } from '@/lib/delete-account';

type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

type DriverHomeScreenProps = {
  navigation: NativeStackNavigationProp<DriverStackParamList, 'DriverHome'>;
};

function greetingForNow(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function firstNameFromUser(name?: string, email?: string): string {
  const fromName = name?.trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const fromEmail = email?.split('@')[0];
  return fromEmail || 'Driver';
}

function isShiftOnline(shift: DriverShift | null): boolean {
  return Boolean(shift?.shiftStartedAt && !shift?.shiftEndedAt);
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { refreshDriverStatus } = useDriverStatus();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const [shift, setShift] = useState<DriverShift | null>(null);
  const [shiftLoading, setShiftLoading] = useState(false);
  const [todaysEarnings] = useState(0);
  const mapRef = useRef<DriverMapHandle>(null);
  const gateChecked = useRef(false);

  const driverId = user?.id ?? '';
  const isOnline = isShiftOnline(shift);
  const driverName = firstNameFromUser(user?.name, user?.email);

  useEffect(() => {
    if (gateChecked.current || !driverId) return;
    gateChecked.current = true;
    refreshDriverStatus();
  }, [driverId, refreshDriverStatus]);

  const requestLocationIfNeeded = useCallback(async () => {
    if (Platform.OS === 'web') return true;
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status === 'granted') return true;
    Alert.alert(
      'Location required',
      'Turn on location access so we can show you on the map and match nearby jobs.'
    );
    return false;
  }, []);

  const handleToggleOnline = useCallback(async () => {
    if (!driverId) return;
    if (!isApproved) {
      showPendingAlert();
      return;
    }
    if (shiftLoading) return;

    if (!isOnline) {
      const allowed = await requestLocationIfNeeded();
      if (!allowed) return;
    }

    setShiftLoading(true);
    try {
      if (isOnline) {
        const next = await endShift(driverId);
        setShift(next);
        await trackEvent('driver_end_shift', { screen: 'driver_home' });
      } else {
        const next = await startShift(driverId);
        setShift(next);
        await trackEvent('driver_start_shift', { screen: 'driver_home' });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not update your online status';
      Alert.alert('Error', msg);
    } finally {
      setShiftLoading(false);
    }
  }, [
    driverId,
    isApproved,
    isOnline,
    requestLocationIfNeeded,
    shiftLoading,
    showPendingAlert,
  ]);

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

  const runMenuAction = useCallback(
    (index: number) => {
      if (index === 0) navigation.navigate('DriverJobList');
      if (index === 1) void handleLogout();
      if (index === 2) void handleDeleteAccount();
    },
    [handleDeleteAccount, handleLogout, navigation]
  );

  const handleMenuPress = useCallback(() => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['My Jobs', 'Logout', 'Delete Account', 'Cancel'],
          destructiveButtonIndex: 2,
          cancelButtonIndex: 3,
        },
        (buttonIndex) => {
          if (buttonIndex === undefined || buttonIndex === 3) return;
          runMenuAction(buttonIndex);
        }
      );
      return;
    }

    Alert.alert('Menu', undefined, [
      { text: 'My Jobs', onPress: () => runMenuAction(0) },
      { text: 'Logout', onPress: () => runMenuAction(1) },
      { text: 'Delete Account', style: 'destructive', onPress: () => runMenuAction(2) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [runMenuAction]);

  const greeting = useMemo(() => greetingForNow(), []);

  return (
    <View style={styles.container}>
      <DriverMap ref={mapRef} />

      <TopBar
        isOnline={isOnline}
        onToggleOnline={() => {
          void handleToggleOnline();
        }}
        onMenuPress={handleMenuPress}
        onNotificationsPress={() => {
          Alert.alert('Notifications', 'Driver notifications are coming soon.');
        }}
        topInset={insets.top}
        toggleDisabled={shiftLoading}
      />

      {!isApproved && (
        <View style={[styles.bannerWrap, { top: insets.top + 60 }]}>
          <DriverApprovalBanner />
        </View>
      )}

      <MapControls
        bottomOffset={isOnline ? 260 + insets.bottom : 250 + insets.bottom}
        onCompassPress={() => mapRef.current?.resetHeading()}
        onLayersPress={() => {
          Alert.alert('Map style', 'Satellite, traffic, and streets switching is coming soon.');
        }}
        onRecenterPress={() => mapRef.current?.recenter()}
      />

      <HomeSheet
        greeting={greeting}
        driverName={driverName}
        isOnline={isOnline}
        todaysEarnings={todaysEarnings}
        onToggleOnline={() => {
          void handleToggleOnline();
        }}
        onEarningsPress={() => {
          Alert.alert("Today's earnings", 'A full earnings breakdown is coming soon.');
        }}
        toggleLoading={shiftLoading}
        bottomInset={insets.bottom}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.mapBg,
  },
  bannerWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 28,
    borderRadius: 12,
    overflow: 'hidden',
  },
});

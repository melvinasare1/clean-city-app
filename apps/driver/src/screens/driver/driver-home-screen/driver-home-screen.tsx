import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { useDriverPresence } from '@/hooks/useDriverPresence';
import { DriverApprovalBanner } from '@/components/driver/DriverApprovalBanner';
import { TopBar } from '@/components/driver/home/TopBar';
import { MapControls } from '@/components/driver/home/MapControls';
import { HomeSheet } from '@/components/driver/home/HomeSheet';
import { JobOfferSheet } from '@/components/driver/home/JobOfferSheet';
import { DriverMap } from '@/components/driver/home/DriverMap';
import type { DriverMapHandle } from '@/components/driver/home/driver-map.types';
import { colors } from '@platform/shared-theme';
import { trackEvent } from '@/services/analytics';
import { openDeleteAccountSupport } from '@/lib/delete-account';
import { useAssignedJobOffer } from '@/hooks/useAssignedJobOffer';
import type { DriverStackParamList } from '@/navigation/types';

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

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ navigation }) => {
  const { user, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const [toggleLoading, setToggleLoading] = useState(false);
  const [todaysEarnings] = useState(0);
  const mapRef = useRef<DriverMapHandle>(null);
  const { offer, accept, decline } = useAssignedJobOffer();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const driverId = user?.id ?? '';
  const driverName = firstNameFromUser(user?.name, user?.email);
  const { isOnline, goOnline, goOffline } = useDriverPresence(driverId);

  const handleToggleOnline = useCallback(async () => {
    if (!driverId) return;
    if (!isApproved) {
      showPendingAlert();
      return;
    }
    if (toggleLoading) return;

    setToggleLoading(true);
    try {
      if (isOnline) {
        await goOffline();
        await trackEvent('driver_end_shift', { screen: 'driver_home' });
      } else {
        const started = await goOnline();
        if (started) {
          await trackEvent('driver_start_shift', { screen: 'driver_home' });
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not update your online status';
      Alert.alert('Error', msg);
    } finally {
      setToggleLoading(false);
    }
  }, [driverId, goOffline, goOnline, isApproved, isOnline, showPendingAlert, toggleLoading]);

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

  const handleAccept = useCallback(async () => {
    if (!offer) return;
    setAccepting(true);
    try {
      await accept(offer.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not accept this job';
      Alert.alert('Error', msg);
    } finally {
      setAccepting(false);
    }
  }, [accept, offer]);

  const handleDecline = useCallback(async () => {
    if (!offer) return;
    setDeclining(true);
    try {
      await decline(offer.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not decline this job';
      Alert.alert('Error', msg);
    } finally {
      setDeclining(false);
    }
  }, [decline, offer]);

  const greeting = useMemo(() => greetingForNow(), []);

  const openEarnings = useCallback(() => {
    navigation.navigate('DailyEarningsDetails');
  }, [navigation]);

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
        toggleDisabled={toggleLoading}
      />

      {!isApproved && (
        <View style={[styles.bannerWrap, { top: insets.top + 60 }]}>
          <DriverApprovalBanner />
        </View>
      )}

      {offer ? (
        <Pressable
          style={[styles.declinePill, { top: insets.top + 54 }]}
          onPress={() => {
            void handleDecline();
          }}
          disabled={accepting || declining}
          accessibilityRole="button"
          accessibilityLabel="Decline job"
        >
          <Text style={styles.declineLabel}>{declining ? 'Declining…' : 'Decline'}</Text>
        </Pressable>
      ) : null}

      <MapControls
        bottomOffset={isOnline || offer ? 260 + insets.bottom : 250 + insets.bottom}
        onCompassPress={() => mapRef.current?.resetHeading()}
        onLayersPress={() => {
          Alert.alert('Map style', 'Satellite, traffic, and streets switching is coming soon.');
        }}
        onRecenterPress={() => mapRef.current?.recenter()}
      />

      {offer ? (
        <JobOfferSheet
          offer={offer}
          onAccept={() => {
            void handleAccept();
          }}
          accepting={accepting}
          bottomInset={insets.bottom}
        />
      ) : (
        <HomeSheet
          greeting={greeting}
          driverName={driverName}
          isOnline={isOnline}
          todaysEarnings={todaysEarnings}
          onToggleOnline={() => {
            void handleToggleOnline();
          }}
          onEarningsPress={openEarnings}
          toggleLoading={toggleLoading}
          bottomInset={insets.bottom}
        />
      )}
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
  declinePill: {
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: '-50%' }],
    zIndex: 29,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  declineLabel: {
    fontSize: 11,
    color: colors.inkSecondary,
  },
});

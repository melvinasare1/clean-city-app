import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CompositeNavigationProp } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
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
import { ActiveTripSheet } from '@/components/driver/home/ActiveTripSheet';
import { DriverMap } from '@/components/driver/home/DriverMap';
import type { DriverMapHandle } from '@/components/driver/home/driver-map.types';
import { colors } from '@platform/shared-theme';
import { trackEvent } from '@/services/analytics';
import { BriefToast, useBriefToast } from '@/components/driver/BriefToast';
import { useAssignedJobOffer } from '@/hooks/useAssignedJobOffer';
import { useDriverPriority } from '@/hooks/useDriverPriority';
import { startJob } from '@/services/driver-api';
import type { DriverStackParamList, DriverTabParamList } from '@/navigation/types';

type DriverHomeScreenProps = {
  navigation: CompositeNavigationProp<
    BottomTabNavigationProp<DriverTabParamList, 'Orders'>,
    NativeStackNavigationProp<DriverStackParamList>
  >;
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const [toggleLoading, setToggleLoading] = useState(false);
  const [todaysEarnings] = useState(0);
  const mapRef = useRef<DriverMapHandle>(null);
  const { offer, activeTrip, accept, decline, complete, cancel } = useAssignedJobOffer();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const { toast, showToast } = useBriefToast();

  const driverId = user?.id ?? '';
  const driverName = firstNameFromUser(user?.name, user?.email);
  const { isOnline, goOnline, goOffline } = useDriverPresence(driverId);
  const priority = useDriverPriority(driverId);

  const handleToggleOnline = useCallback(async () => {
    if (!driverId) return;
    if (!isApproved) {
      showPendingAlert();
      return;
    }
    if (toggleLoading) return;
    if (isOnline && activeTrip) {
      Alert.alert("Can't go offline", "You can't go offline while you're on a job.");
      return;
    }

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
  }, [activeTrip, driverId, goOffline, goOnline, isApproved, isOnline, showPendingAlert, toggleLoading]);

  const handleAccept = useCallback(async () => {
    if (!offer) return;
    setAccepting(true);
    try {
      await accept(offer.id);
      showToast('Priority +4');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not accept this job';
      Alert.alert('Error', msg);
    } finally {
      setAccepting(false);
    }
  }, [accept, offer, showToast]);

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

  const handleStart = useCallback(async () => {
    if (!activeTrip || !driverId) return;
    setStarting(true);
    try {
      await startJob(activeTrip.id, driverId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start this job';
      Alert.alert('Error', msg);
    } finally {
      setStarting(false);
    }
  }, [activeTrip, driverId]);

  const handleComplete = useCallback(async () => {
    if (!activeTrip) return;
    setCompleting(true);
    try {
      await complete(activeTrip.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not complete this job';
      Alert.alert('Error', msg);
    } finally {
      setCompleting(false);
    }
  }, [activeTrip, complete]);

  const handleCancelTrip = useCallback(() => {
    if (!activeTrip) return;
    void (async () => {
      setCancelling(true);
      try {
        await cancel(activeTrip.id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not cancel this trip';
        Alert.alert('Error', msg);
      } finally {
        setCancelling(false);
      }
    })();
  }, [activeTrip, cancel]);

  const pickupCoordinate = useMemo((): [number, number] | null => {
    const pickup = offer?.pickup ?? activeTrip?.pickup;
    if (!pickup) return null;
    return [pickup.lng, pickup.lat];
  }, [activeTrip, offer]);

  const greeting = useMemo(() => greetingForNow(), []);

  const openEarnings = useCallback(() => {
    navigation.navigate('Earnings');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <DriverMap ref={mapRef} pickupCoordinate={pickupCoordinate} />

      <TopBar
        isOnline={isOnline}
        onToggleOnline={() => {
          void handleToggleOnline();
        }}
        priority={priority}
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
        bottomOffset={isOnline || offer || activeTrip ? 260 : 250}
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
          bottomInset={0}
        />
      ) : activeTrip ? (
        <ActiveTripSheet
          trip={activeTrip}
          onStart={() => {
            void handleStart();
          }}
          onComplete={() => {
            void handleComplete();
          }}
          onCancel={handleCancelTrip}
          starting={starting}
          completing={completing}
          cancelling={cancelling}
          bottomInset={0}
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
          bottomInset={0}
        />
      )}

      <BriefToast message={toast} topOffset={insets.top + 56} />
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

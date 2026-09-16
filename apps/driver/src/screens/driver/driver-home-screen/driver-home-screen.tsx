import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CompositeNavigationProp, useFocusEffect } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useDriverApproved } from '@/hooks/useDriverApproved';
import { useDriverPresence } from '@/hooks/useDriverPresence';
import { DriverApprovalBanner } from '@/components/driver/DriverApprovalBanner';
import { TopBar } from '@/components/driver/home/TopBar';
import { HomeSheet } from '@/components/driver/home/HomeSheet';
import { JobOfferSheet } from '@/components/driver/home/JobOfferSheet';
import { ActiveTripSheet } from '@/components/driver/home/ActiveTripSheet';
import { DriverMap } from '@/components/driver/home/DriverMap';
import { colors } from '@platform/shared-theme';
import { trackEvent } from '@/services/analytics';
import { BriefToast, useBriefToast } from '@/components/driver/BriefToast';
import { CancelReasonModal } from '@/components/driver/CancelReasonModal';
import type { CancelReasonCode } from '@platform/shared-types';
import { useAssignedJobOffer, type ActiveTrip } from '@/hooks/useAssignedJobOffer';
import { useDriverEarnings } from '@/hooks/useDriverEarnings';
import { useDriverPriority } from '@/hooks/useDriverPriority';
import { startJob } from '@/services/driver-api';
import { openNavigationTo } from '@/lib/open-navigation';
import {
  consumeResumeOnlineAfterConsent,
  hasAcknowledgedBackgroundLocation,
} from '@/lib/driver-background-location';
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

function tripNavigationDestination(trip: ActiveTrip | null) {
  if (!trip) return { lat: null, lng: null, address: null };
  const address =
    [trip.addressLine1, trip.area, trip.address, trip.location]
      .map((part) => (typeof part === 'string' ? part.trim() : ''))
      .filter(Boolean)
      .filter((part, index, all) => all.indexOf(part) === index)
      .join(', ') || null;
  return {
    lat: trip.pickup?.lat ?? null,
    lng: trip.pickup?.lng ?? null,
    address,
  };
}

export const DriverHomeScreen: React.FC<DriverHomeScreenProps> = ({ navigation }) => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { isApproved, showPendingAlert } = useDriverApproved();
  const [toggleLoading, setToggleLoading] = useState(false);
  const { offer, activeTrip, accept, decline, complete, cancel, markArrived } =
    useAssignedJobOffer();
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [arriving, setArriving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReasonModalVisible, setCancelReasonModalVisible] = useState(false);
  const { toast, showToast } = useBriefToast();

  const driverId = user?.id ?? '';
  const driverName = firstNameFromUser(user?.name, user?.email);
  const { isOnline, isSharingLocation, goOnline, goOffline } = useDriverPresence(
    driverId,
    Boolean(activeTrip)
  );
  const priority = useDriverPriority(driverId);
  const today = useMemo(() => new Date(), []);
  const { totalEarnings: todaysEarnings } = useDriverEarnings(driverId, today);

  const handleToggleOnline = useCallback(() => {
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

    const applyToggle = async () => {
      setToggleLoading(true);
      try {
        if (isOnline) {
          await goOffline();
          await trackEvent('driver_end_shift', { screen: 'driver_home' });
        } else {
          if (await hasAcknowledgedBackgroundLocation()) {
            const started = await goOnline();
            if (started) {
              await trackEvent('driver_start_shift', { screen: 'driver_home' });
            }
          } else {
            navigation.navigate('BackgroundLocationConsent');
          }
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Could not update your online status';
        Alert.alert('Error', msg);
      } finally {
        setToggleLoading(false);
      }
    };

    if (isOnline) {
      Alert.alert('Go offline?', 'Are you sure you want to go offline?', [
        { text: 'Stay online', style: 'cancel' },
        { text: 'Go offline', onPress: () => void applyToggle() },
      ]);
      return;
    }

    void applyToggle();
  }, [activeTrip, driverId, goOffline, goOnline, isApproved, isOnline, navigation, showPendingAlert, toggleLoading]);

  useFocusEffect(
    useCallback(() => {
      if (!driverId || !isApproved || isOnline) return;
      if (!consumeResumeOnlineAfterConsent()) return;
      void (async () => {
        setToggleLoading(true);
        try {
          const started = await goOnline();
          if (started) {
            await trackEvent('driver_start_shift', { screen: 'driver_home' });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not update your online status';
          Alert.alert('Error', msg);
        } finally {
          setToggleLoading(false);
        }
      })();
    }, [driverId, goOnline, isApproved, isOnline])
  );

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
      await openNavigationTo(tripNavigationDestination(activeTrip));
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not start this job';
      Alert.alert('Error', msg);
    } finally {
      setStarting(false);
    }
  }, [activeTrip, driverId]);

  const handleNavigate = useCallback(() => {
    void openNavigationTo(tripNavigationDestination(activeTrip));
  }, [activeTrip]);

  const handleArrived = useCallback(async () => {
    if (!activeTrip) return;
    setArriving(true);
    try {
      await markArrived(activeTrip.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not mark arrival';
      Alert.alert('Error', msg);
    } finally {
      setArriving(false);
    }
  }, [activeTrip, markArrived]);

  const handleOpenJobSheet = useCallback(() => {
    if (!activeTrip) return;
    navigation.navigate('JobSheet', { jobId: activeTrip.id });
  }, [activeTrip, navigation]);

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
    setCancelReasonModalVisible(true);
  }, [activeTrip]);

  const handleSubmitCancelReason = useCallback(
    (reasonCode: CancelReasonCode, reasonNote?: string) => {
      if (!activeTrip) return;
      setCancelReasonModalVisible(false);
      void (async () => {
        setCancelling(true);
        try {
          await cancel(activeTrip.id, reasonCode, reasonNote);
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Could not cancel this trip';
          Alert.alert('Error', msg);
        } finally {
          setCancelling(false);
        }
      })();
    },
    [activeTrip, cancel]
  );

  const pickupCoordinate = useMemo((): [number, number] | null => {
    const pickup = offer?.pickup ?? activeTrip?.pickup;
    if (!pickup) return null;
    return [pickup.lng, pickup.lat];
  }, [activeTrip, offer]);
  const [routeAwayLabel, setRouteAwayLabel] = useState<string | null>(null);

  useEffect(() => {
    console.log('[DriverHome] offer.pickup', offer?.pickup ?? null);
    console.log('[DriverHome] activeTrip.pickup', activeTrip?.pickup ?? null);
    console.log('[DriverHome] pickupCoordinate passed to map', pickupCoordinate);
  }, [activeTrip, offer, pickupCoordinate]);

  const greeting = useMemo(() => greetingForNow(), []);

  const openEarnings = useCallback(() => {
    navigation.navigate('Earnings');
  }, [navigation]);

  return (
    <View style={styles.container}>
      <DriverMap
        pickupCoordinate={pickupCoordinate}
        onRouteAwayLabelChange={setRouteAwayLabel}
      />

      <TopBar
        isOnline={isOnline}
        isSharingLocation={isSharingLocation}
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

      {offer ? (
        <JobOfferSheet
          offer={offer}
          onAccept={() => {
            void handleAccept();
          }}
          accepting={accepting}
          bottomInset={0}
          routeAwayLabel={routeAwayLabel}
        />
      ) : activeTrip ? (
        <ActiveTripSheet
          trip={activeTrip}
          onStart={() => {
            void handleStart();
          }}
          onNavigate={handleNavigate}
          onArrived={() => {
            void handleArrived();
          }}
          onOpenJobSheet={handleOpenJobSheet}
          onComplete={() => {
            void handleComplete();
          }}
          onCancel={handleCancelTrip}
          starting={starting}
          arriving={arriving}
          completing={completing}
          cancelling={cancelling}
          bottomInset={0}
          routeAwayLabel={routeAwayLabel}
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
      <CancelReasonModal
        visible={cancelReasonModalVisible}
        onClose={() => setCancelReasonModalVisible(false)}
        onSubmit={handleSubmitCancelReason}
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

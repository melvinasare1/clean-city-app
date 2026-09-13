import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE, type Details, type Region } from 'react-native-maps';
import { AppText } from '@/components';
import { useAuth } from '@/hooks/useAuth';
import { COLORS } from '@/lib/constants';
import {
  getDeviceCoordinates,
  getGrantedDeviceCoordinates,
} from '@/lib/device-location';
import { getPlaceDetails, type AddressSuggestion } from '@/lib/google-places-search';
import { geocodeAddress, reverseGeocode } from '@/lib/google-geocode';
import {
  GHANA_FALLBACK_CENTER,
  type PickupCoordinates,
} from '@/lib/profile-location';
import { CustomerStackParamList } from '@/navigation/types';
import { persistPickupLocationToProfile } from './persist-pickup-location';
import { PickupLocationChrome } from './pickup-location-chrome';
import { styles } from './set-pickup-location-screen.styles';
import { usePickupSearch } from './use-pickup-search';

const STREET_DELTA = 0.006;
const CITY_DELTA = 0.08;
const REVERSE_DEBOUNCE_MS = 400;
const ANIMATE_DURATION_MS = 700;

type Props = NativeStackScreenProps<CustomerStackParamList, 'SetPickupLocation'>;

function regionFrom(location: PickupCoordinates, delta: number): Region {
  return {
    latitude: location.lat,
    longitude: location.lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  };
}

export function SetPickupLocationMapScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const { user, refreshUserProfile } = useAuth();
  const mapRef = useRef<MapView>(null);
  const cameraCenterRef = useRef<PickupCoordinates | null>(
    route.params?.initialLocation ?? null
  );
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseAbortRef = useRef(0);

  const [query, setQuery] = useState(route.params?.initialAddress ?? '');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapMoving, setMapMoving] = useState(false);
  const [liveAddress, setLiveAddress] = useState<string | null>(
    route.params?.initialAddress?.trim() || null
  );
  const [initialRegion, setInitialRegion] = useState<Region | null>(null);

  const {
    suggestions,
    searching,
    sessionTokenRef,
    resetSession,
    clearSuggestions,
  } = usePickupSearch(query);

  const scheduleReverse = useCallback((location: PickupCoordinates) => {
    if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    const requestId = reverseAbortRef.current + 1;
    reverseAbortRef.current = requestId;
    setGeocoding(true);
    console.log('[pickup] scheduleReverse queued', requestId, location);
    reverseTimerRef.current = setTimeout(() => {
      console.log('[pickup] reverse geocode start', requestId, location);
      reverseGeocode(location.lat, location.lng)
        .then((hit) => {
          console.log('[pickup] reverse geocode resolved', requestId, hit);
          if (reverseAbortRef.current !== requestId) return;
          setLiveAddress(hit?.address || hit?.name?.trim() || null);
        })
        .catch((err) => {
          console.error('[pickup] reverse geocode failed', requestId, err);
          if (reverseAbortRef.current !== requestId) return;
          setLiveAddress(null);
        })
        .finally(() => {
          if (reverseAbortRef.current === requestId) setGeocoding(false);
        });
    }, REVERSE_DEBOUNCE_MS);
  }, []);

  // Jumping the camera (GPS button or search selection) is imperative:
  // animateToRegion has no promise to await for "animation finished." Unlike
  // the old Mapbox onMapIdle event — which on some devices did not reliably
  // fire after a programmatic flyTo and left the address stuck on "Finding
  // address…" forever — react-native-maps' onRegionChangeComplete fires
  // reliably both after a user drag AND after animateToRegion completes, so
  // this is the single source of truth for "camera settled, go reverse
  // geocode." No watchdog timer needed here.
  const flyTo = useCallback((location: PickupCoordinates, delta = STREET_DELTA) => {
    cameraCenterRef.current = location;
    setMapMoving(true);
    console.log('[pickup] flyTo', location, delta);
    mapRef.current?.animateToRegion(regionFrom(location, delta), ANIMATE_DURATION_MS);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const resolveStart = async () => {
      const gps = await getGrantedDeviceCoordinates();
      if (cancelled) return;
      if (gps) {
        cameraCenterRef.current = gps;
        setInitialRegion(regionFrom(gps, STREET_DELTA));
        scheduleReverse(gps);
        return;
      }

      const saved = route.params?.initialLocation ?? null;
      if (saved) {
        cameraCenterRef.current = saved;
        setInitialRegion(regionFrom(saved, STREET_DELTA));
        scheduleReverse(saved);
        return;
      }

      const typed = route.params?.initialAddress?.trim();
      if (typed) {
        const hit = await geocodeAddress(typed);
        if (cancelled) return;
        if (hit) {
          const location = { lat: hit.lat, lng: hit.lng };
          cameraCenterRef.current = location;
          setInitialRegion(regionFrom(location, STREET_DELTA));
          scheduleReverse(location);
          return;
        }
      }

      cameraCenterRef.current = GHANA_FALLBACK_CENTER;
      setInitialRegion(regionFrom(GHANA_FALLBACK_CENTER, CITY_DELTA));
      scheduleReverse(GHANA_FALLBACK_CENTER);
    };

    void resolveStart();
    return () => {
      cancelled = true;
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
    };
  }, [route.params?.initialAddress, route.params?.initialLocation, scheduleReverse]);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    Keyboard.dismiss();
    setResolving(true);
    clearSuggestions();
    try {
      // This Details call must reuse the session token every autocomplete
      // request in this search used — that's what closes the session for
      // billing. resetSession() right after (success or failure) starts a
      // fresh token for the next search; skipping either half bills every
      // keystroke instead of the session as a whole.
      const details = await getPlaceDetails(suggestion.id, sessionTokenRef.current);
      resetSession();
      if (!details) {
        Alert.alert('Address lookup failed', 'Please try another search result.');
        return;
      }
      setQuery(details.formattedAddress || suggestion.label);
      flyTo(details.location, STREET_DELTA);
    } catch (err) {
      console.error('Address details failed:', err);
      Alert.alert(
        'Address lookup failed',
        err instanceof Error ? err.message : 'Please try another search result.'
      );
    } finally {
      setResolving(false);
    }
  };

  const handleUseCurrentLocation = async () => {
    Keyboard.dismiss();
    setLocating(true);
    try {
      const position = await getDeviceCoordinates();
      clearSuggestions();
      resetSession();
      flyTo(position, STREET_DELTA);
    } catch (err) {
      console.error('Current location failed:', err);
      const message = err instanceof Error ? err.message : '';
      if (message === 'LOCATION_PERMISSION_DENIED') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to center the map on your GPS position.'
        );
        return;
      }
      if (message === 'NATIVE_MODULE_MISSING') {
        Alert.alert(
          'GPS needs a rebuilt app',
          'This install of Clean City was built before location support was added. Use address search for now, or rebuild the customer dev client to enable GPS.'
        );
        return;
      }
      Alert.alert(
        'Location failed',
        'We could not read your current location. Check permissions and try again, or search for the address instead.'
      );
    } finally {
      setLocating(false);
    }
  };

  const handleConfirm = async () => {
    const location = cameraCenterRef.current;
    if (!location) return;
    const address = (liveAddress || query).trim() || 'Selected location';
    if (route.params?.saveToProfile) {
      if (!user?.id) {
        Alert.alert('Error', 'You need to be logged in to save a pickup address.');
        return;
      }
      try {
        await persistPickupLocationToProfile(user.id, address, location);
        await refreshUserProfile();
        navigation.goBack();
      } catch (err) {
        console.error('[pickup] persist address failed', err);
        Alert.alert(
          'Could not save address',
          err instanceof Error ? err.message : 'Please try again.'
        );
      }
      return;
    }
    navigation.navigate({
      name: 'CompleteProfile',
      params: { pickup: { address, location } },
      merge: true,
    });
  };

  const canConfirm =
    !!initialRegion && !mapMoving && !geocoding && !resolving && !locating;

  return (
    <View style={styles.root}>
      {initialRegion ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          // iOS Google tiles need GMSApiKey in the native binary. The current
          // dev client was built with the uninterpolated app.json placeholder,
          // so Apple Maps is used here. Android still uses Google Maps.
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={initialRegion}
          showsUserLocation
          showsMyLocationButton={false}
          onTouchStart={() => Keyboard.dismiss()}
          onRegionChange={(_region: Region, details: Details) => {
            if (details?.isGesture) setMapMoving(true);
          }}
          onRegionChangeComplete={(region: Region, details: Details) => {
            console.log('[pickup] onRegionChangeComplete', region, details);
            const next = { lat: region.latitude, lng: region.longitude };
            cameraCenterRef.current = next;
            scheduleReverse(next);
            setMapMoving(false);
          }}
        />
      ) : (
        <View style={styles.fallback}>
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}

      <View pointerEvents="none" style={styles.centerAnchor}>
        <View style={styles.pinDot} />
        <View style={styles.centerPin}>
          <Ionicons name="location" size={44} color={COLORS.primary} />
        </View>
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.overlay,
          { paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <PickupLocationChrome
          query={query}
          onQueryChange={setQuery}
          searching={searching}
          resolving={resolving}
          locating={locating}
          geocoding={geocoding}
          suggestions={suggestions}
          liveAddress={liveAddress}
          mapMoving={mapMoving}
          canConfirm={canConfirm}
          onBack={() => navigation.goBack()}
          onSelectSuggestion={(item) => void handleSelect(item)}
          onUseCurrentLocation={() => void handleUseCurrentLocation()}
          onConfirm={handleConfirm}
        />
      </View>
    </View>
  );
}

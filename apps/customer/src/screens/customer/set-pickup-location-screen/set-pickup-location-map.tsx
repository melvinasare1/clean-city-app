import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';
import {
  getDeviceCoordinates,
  getGrantedDeviceCoordinates,
} from '@/lib/device-location';
import { getPlaceDetails, type AddressSuggestion } from '@/lib/google-places-search';
import { resolveMapboxToken } from '@/lib/mapbox-access-token';
import { reverseGeocodePermanent, geocodeAddressPermanent } from '@/lib/permanent-geocode';
import {
  GHANA_FALLBACK_CENTER,
  parsePickupCoordinates,
  type PickupCoordinates,
} from '@/lib/profile-location';
import { CustomerStackParamList } from '@/navigation/types';
import { PickupLocationChrome } from './pickup-location-chrome';
import { styles } from './set-pickup-location-screen.styles';
import { usePickupSearch } from './use-pickup-search';

const STREET_ZOOM = 16;
const CITY_ZOOM = 12;
const REVERSE_DEBOUNCE_MS = 400;

const accessToken = resolveMapboxToken();
if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}

type Props = NativeStackScreenProps<CustomerStackParamList, 'SetPickupLocation'>;

function centerFromState(center: unknown): PickupCoordinates | null {
  if (!Array.isArray(center) || center.length < 2) return null;
  return parsePickupCoordinates({ lng: center[0], lat: center[1] });
}

function isUserCameraGesture(state: {
  gestures?: { isGestureActive?: boolean };
}): boolean {
  return state.gestures?.isGestureActive === true;
}

export function SetPickupLocationMapScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<Camera>(null);
  const cameraCenterRef = useRef<PickupCoordinates | null>(
    route.params?.initialLocation ?? null
  );
  const reverseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reverseAbortRef = useRef(0);
  const flyToWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [query, setQuery] = useState(route.params?.initialAddress ?? '');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapMoving, setMapMoving] = useState(false);
  const [liveAddress, setLiveAddress] = useState<string | null>(
    route.params?.initialAddress?.trim() || null
  );
  const [initialCamera, setInitialCamera] = useState<{
    center: [number, number];
    zoom: number;
  } | null>(null);

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
      reverseGeocodePermanent(location.lat, location.lng)
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

  // Jumping the camera (GPS button or search selection) is imperative and
  // fire-and-forget: `Camera.setCamera` returns void, so there is no promise
  // to await for "animation finished." We already know the destination
  // synchronously, so kick off the reverse-geocode right away instead of
  // waiting on `onMapIdle` — on some devices that native idle event does not
  // reliably fire after a programmatic flyTo, which previously left the
  // address stuck on "Finding address…" forever for both the GPS and search
  // paths (they both funnel through this function). The watchdog below is a
  // matching safety net for `mapMoving`, which is only otherwise cleared by
  // that same idle event.
  const flyTo = useCallback((location: PickupCoordinates, zoom = STREET_ZOOM) => {
    cameraCenterRef.current = location;
    setMapMoving(true);
    console.log('[pickup] flyTo', location, zoom);
    cameraRef.current?.setCamera({
      centerCoordinate: [location.lng, location.lat],
      zoomLevel: zoom,
      animationMode: 'flyTo',
      animationDuration: 700,
    });
    scheduleReverse(location);

    if (flyToWatchdogRef.current) clearTimeout(flyToWatchdogRef.current);
    flyToWatchdogRef.current = setTimeout(() => {
      console.log('[pickup] flyTo watchdog fired — onMapIdle did not clear mapMoving in time');
      setMapMoving(false);
    }, 1200);
  }, [scheduleReverse]);

  useEffect(() => {
    let cancelled = false;

    const resolveStart = async () => {
      const gps = await getGrantedDeviceCoordinates();
      if (cancelled) return;
      if (gps) {
        cameraCenterRef.current = gps;
        setInitialCamera({ center: [gps.lng, gps.lat], zoom: STREET_ZOOM });
        scheduleReverse(gps);
        return;
      }

      const saved = route.params?.initialLocation ?? null;
      if (saved) {
        cameraCenterRef.current = saved;
        setInitialCamera({ center: [saved.lng, saved.lat], zoom: STREET_ZOOM });
        scheduleReverse(saved);
        return;
      }

      const typed = route.params?.initialAddress?.trim();
      if (typed) {
        const hit = await geocodeAddressPermanent(typed);
        if (cancelled) return;
        if (hit) {
          const location = { lat: hit.lat, lng: hit.lng };
          cameraCenterRef.current = location;
          setInitialCamera({
            center: [hit.lng, hit.lat],
            zoom: STREET_ZOOM,
          });
          scheduleReverse(location);
          return;
        }
      }

      cameraCenterRef.current = GHANA_FALLBACK_CENTER;
      setInitialCamera({
        center: [GHANA_FALLBACK_CENTER.lng, GHANA_FALLBACK_CENTER.lat],
        zoom: CITY_ZOOM,
      });
      scheduleReverse(GHANA_FALLBACK_CENTER);
    };

    void resolveStart();
    return () => {
      cancelled = true;
      if (reverseTimerRef.current) clearTimeout(reverseTimerRef.current);
      if (flyToWatchdogRef.current) clearTimeout(flyToWatchdogRef.current);
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
      flyTo(details.location, STREET_ZOOM);
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
      flyTo(position, STREET_ZOOM);
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

  const handleConfirm = () => {
    const location = cameraCenterRef.current;
    if (!location) return;
    const address = (liveAddress || query).trim() || 'Selected location';
    navigation.navigate({
      name: 'CompleteProfile',
      params: { pickup: { address, location } },
      merge: true,
    });
  };

  const canConfirm =
    !!initialCamera && !mapMoving && !geocoding && !resolving && !locating;

  if (!accessToken) {
    return (
      <View style={styles.root}>
        <View style={styles.fallback}>
          <AppText style={styles.fallbackTitle}>Mapbox token missing</AppText>
          <AppText style={styles.fallbackBody}>
            Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN, then rebuild the native app.
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {initialCamera ? (
        <MapView
          style={styles.map}
          styleURL={Mapbox.StyleURL.Street}
          logoEnabled={false}
          attributionPosition={{ bottom: 8, left: 12 }}
          onTouchStart={() => Keyboard.dismiss()}
          onCameraChanged={(state) => {
            const next = centerFromState(state.properties?.center);
            if (next) cameraCenterRef.current = next;
            if (isUserCameraGesture(state)) {
              setMapMoving(true);
            }
          }}
          onMapIdle={(state) => {
            console.log('[pickup] onMapIdle fired', state.properties?.center);
            if (flyToWatchdogRef.current) {
              clearTimeout(flyToWatchdogRef.current);
              flyToWatchdogRef.current = null;
            }
            const next = centerFromState(state.properties?.center);
            if (next) {
              cameraCenterRef.current = next;
              scheduleReverse(next);
            }
            setMapMoving(false);
          }}
        >
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: initialCamera.center,
              zoomLevel: initialCamera.zoom,
              animationDuration: 0,
              animationMode: 'none',
            }}
          />
          <UserLocation
            visible
            showsUserHeadingIndicator
            androidRenderMode="normal"
          />
        </MapView>
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

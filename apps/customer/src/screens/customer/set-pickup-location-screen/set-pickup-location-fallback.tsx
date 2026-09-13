import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Keyboard, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/components';
import { getDeviceCoordinates } from '@/lib/device-location';
import { getPlaceDetails, type AddressSuggestion } from '@/lib/google-places-search';
import { reverseGeocodePermanent } from '@/lib/permanent-geocode';
import {
  GHANA_FALLBACK_CENTER,
  type PickupCoordinates,
} from '@/lib/profile-location';
import { CustomerStackParamList } from '@/navigation/types';
import { PickupLocationChrome } from './pickup-location-chrome';
import { styles } from './set-pickup-location-screen.styles';
import { usePickupSearch } from './use-pickup-search';

type Props = NativeStackScreenProps<CustomerStackParamList, 'SetPickupLocation'>;

export function SetPickupLocationFallbackScreen({ navigation, route }: Props) {
  const insets = useSafeAreaInsets();
  const cameraCenterRef = useRef<PickupCoordinates | null>(
    route.params?.initialLocation ?? GHANA_FALLBACK_CENTER
  );

  const [query, setQuery] = useState(route.params?.initialAddress ?? '');
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [liveAddress, setLiveAddress] = useState<string | null>(
    route.params?.initialAddress?.trim() || null
  );

  const {
    suggestions,
    searching,
    sessionTokenRef,
    resetSession,
    clearSuggestions,
  } = usePickupSearch(query);

  const applyLocation = useCallback((location: PickupCoordinates) => {
    cameraCenterRef.current = location;
    setGeocoding(true);
    reverseGeocodePermanent(location.lat, location.lng)
      .then((hit) => {
        setLiveAddress(hit?.address || hit?.name?.trim() || null);
      })
      .catch(() => setLiveAddress(null))
      .finally(() => setGeocoding(false));
  }, []);

  useEffect(() => {
    const saved = route.params?.initialLocation;
    if (saved) applyLocation(saved);
  }, [applyLocation, route.params?.initialLocation]);

  const handleSelect = async (suggestion: AddressSuggestion) => {
    Keyboard.dismiss();
    setResolving(true);
    clearSuggestions();
    try {
      const details = await getPlaceDetails(suggestion.id, sessionTokenRef.current);
      resetSession();
      if (!details) {
        Alert.alert('Address lookup failed', 'Please try another search result.');
        return;
      }
      setQuery(details.formattedAddress || suggestion.label);
      applyLocation(details.location);
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
      applyLocation(position);
    } catch (err) {
      console.error('Current location failed:', err);
      Alert.alert(
        'Location failed',
        'Search for an address for now. The live map needs a rebuilt customer app with Mapbox linked.'
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
    !!cameraCenterRef.current && !geocoding && !resolving && !locating;

  return (
    <View style={styles.root}>
      <View style={styles.fallback}>
        <AppText style={styles.fallbackTitle}>Rebuild needed for the map</AppText>
        <AppText style={styles.fallbackBody}>
          This install of Clean City was built before Mapbox was added. Reload
          will not fix it — install a new customer development build, then open
          this screen again. Search still works below until then.
        </AppText>
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
          mapMoving={false}
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

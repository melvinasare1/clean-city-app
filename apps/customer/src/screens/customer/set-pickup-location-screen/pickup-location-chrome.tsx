import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';
import type { AddressSuggestion } from '@/lib/google-places-search';
import { styles } from './set-pickup-location-screen.styles';

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  searching: boolean;
  resolving: boolean;
  locating: boolean;
  geocoding: boolean;
  suggestions: AddressSuggestion[];
  liveAddress: string | null;
  mapMoving: boolean;
  canConfirm: boolean;
  onBack: () => void;
  onSelectSuggestion: (item: AddressSuggestion) => void;
  onUseCurrentLocation: () => void;
  onConfirm: () => void;
};

export function PickupLocationChrome({
  query,
  onQueryChange,
  searching,
  resolving,
  locating,
  geocoding,
  suggestions,
  liveAddress,
  mapMoving,
  canConfirm,
  onBack,
  onSelectSuggestion,
  onUseCurrentLocation,
  onConfirm,
}: Props) {
  const statusText = resolving
    ? 'Moving map…'
    : searching
      ? 'Searching…'
      : null;

  const addressLine = mapMoving || geocoding
    ? 'Finding address…'
    : liveAddress;

  return (
    <>
      <View style={styles.topBar}>
        <View style={styles.searchRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.text} />
          </TouchableOpacity>
          <TextInput
            value={query}
            onChangeText={onQueryChange}
            placeholder="Search pickup address"
            placeholderTextColor={COLORS.textSecondary}
            autoCorrect={false}
            autoCapitalize="words"
            style={styles.searchField}
            returnKeyType="search"
          />
        </View>

        {statusText ? (
          <View style={styles.suggestStatus}>
            <ActivityIndicator color={COLORS.primary} />
            <AppText style={styles.suggestStatusText}>{statusText}</AppText>
          </View>
        ) : null}

        {suggestions.length > 0 ? (
          <ScrollView
            style={styles.suggestList}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {suggestions.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.suggestRow}
                onPress={() => onSelectSuggestion(item)}
                disabled={resolving}
              >
                <Ionicons name="location-outline" size={18} color={COLORS.primary} />
                <View style={styles.suggestCopy}>
                  <AppText style={styles.suggestLabel}>{item.label}</AppText>
                  {item.secondary ? (
                    <AppText style={styles.suggestSecondary} numberOfLines={1}>
                      {item.secondary}
                    </AppText>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.overlayFill} />

      <View style={styles.bottomWrap}>
        <TouchableOpacity
          style={styles.gpsChip}
          onPress={onUseCurrentLocation}
          disabled={locating || resolving}
          accessibilityRole="button"
          accessibilityLabel="Use current location"
        >
          {locating ? (
            <ActivityIndicator color={COLORS.primary} />
          ) : (
            <Ionicons name="navigate" size={18} color={COLORS.primary} />
          )}
          <AppText style={styles.gpsChipText}>Use current location</AppText>
        </TouchableOpacity>

        <View style={styles.card}>
          <AppText style={styles.cardKicker}>Pickup at</AppText>
          {addressLine ? (
            <AppText style={styles.cardAddress}>{addressLine}</AppText>
          ) : (
            <AppText style={styles.cardMuted}>
              Pan the map so the pin sits on your building entrance.
            </AppText>
          )}
          <TouchableOpacity
            style={[styles.confirmButton, !canConfirm && styles.confirmButtonDisabled]}
            onPress={onConfirm}
            disabled={!canConfirm}
            accessibilityRole="button"
            accessibilityLabel="Confirm pickup"
          >
            <AppText style={styles.confirmButtonText}>Confirm pickup</AppText>
          </TouchableOpacity>
        </View>
      </View>
    </>
  );
}

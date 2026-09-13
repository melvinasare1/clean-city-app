import React from 'react';
import { TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText } from '@/components';
import { COLORS } from '@/lib/constants';
import type { PickupCoordinates } from '@/lib/profile-location';
import { styles } from './complete-profile-screen.styles';

type Props = {
  address: string;
  location: PickupCoordinates | null;
  onPress: () => void;
};

export function PickupAddressField({ address, location, onPress }: Props) {
  const hasPickup = !!address.trim() && !!location;

  return (
    <TouchableOpacity
      style={styles.pickupRow}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={hasPickup ? 'Change pickup location' : 'Set pickup location'}
    >
      <View style={styles.pickupRowIcon}>
        <Ionicons name="location" size={20} color={COLORS.primary} />
      </View>
      <View style={styles.pickupRowCopy}>
        <AppText
          style={hasPickup ? styles.pickupRowAddress : styles.pickupRowPlaceholder}
          numberOfLines={2}
        >
          {hasPickup ? address : 'Set pickup location'}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={COLORS.textSecondary} />
    </TouchableOpacity>
  );
}

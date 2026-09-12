import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, sizes, spacing } from '@platform/shared-theme';

type Props = {
  onCompassPress: () => void;
  onLayersPress: () => void;
  onRecenterPress: () => void;
  bottomOffset?: number;
};

export function MapControls({
  onCompassPress,
  onLayersPress,
  onRecenterPress,
  bottomOffset = 240,
}: Props) {
  return (
    <View style={[styles.stack, { bottom: bottomOffset }]}>
      <Pressable
        style={styles.button}
        onPress={onCompassPress}
        accessibilityRole="button"
        accessibilityLabel="Reset map heading"
      >
        <Feather name="navigation" size={18} color={colors.inkPrimary} />
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={onLayersPress}
        accessibilityRole="button"
        accessibilityLabel="Map layers"
      >
        <Feather name="layers" size={18} color={colors.inkPrimary} />
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={onRecenterPress}
        accessibilityRole="button"
        accessibilityLabel="Recenter map"
      >
        <Feather name="crosshair" size={18} color={colors.inkPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'absolute',
    right: spacing.md,
    gap: spacing.sm,
    zIndex: 25,
  },
  button: {
    width: sizes.floatingButton,
    height: sizes.floatingButton,
    borderRadius: sizes.floatingButton / 2,
    backgroundColor: colors.surfaceWhite,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
});

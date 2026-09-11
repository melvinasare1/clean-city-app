import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { colors, radius, typography } from '@/theme/driver-home';

type Props = {
  isOnline: boolean;
  onPress: () => void;
  disabled?: boolean;
};

export function StatusPill({ isOnline, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={isOnline ? 'Go offline' : 'Go online'}
      style={[
        styles.pill,
        { backgroundColor: isOnline ? colors.brandGreen : colors.inkCharcoal },
        disabled && styles.disabled,
      ]}
    >
      <View
        style={[
          styles.dot,
          { backgroundColor: isOnline ? colors.brandGreenDot : 'rgba(255,255,255,0.35)' },
        ]}
      />
      <Text style={styles.label}>{isOnline ? 'Online' : 'Offline'}</Text>
      <Feather name="chevron-down" size={16} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: radius.pill,
  },
  disabled: {
    opacity: 0.7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.button,
    color: '#fff',
  },
});

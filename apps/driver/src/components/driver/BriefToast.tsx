import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@platform/shared-theme';

type Props = {
  message: string | null;
  topOffset?: number;
};

export function BriefToast({ message, topOffset = 0 }: Props) {
  if (!message) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { top: topOffset }]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.pill}>
        <Text style={styles.label}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 80,
    alignItems: 'center',
  },
  pill: {
    backgroundColor: colors.inkPrimary,
    borderRadius: radius.card,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: '86%',
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});

export function useBriefToast(durationMs = 2200): {
  toast: string | null;
  showToast: (message: string) => void;
} {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, toast]);

  return { toast, showToast: setToast };
}

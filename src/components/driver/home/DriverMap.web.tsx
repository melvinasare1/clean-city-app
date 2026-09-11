import React, { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/driver-home';
import type { DriverMapHandle } from './driver-map.types';

export const DriverMap = forwardRef<DriverMapHandle>(function DriverMap(_props, ref) {
  useImperativeHandle(ref, () => ({
    recenter: () => {},
    resetHeading: () => {},
  }));

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.fallback]}>
      <Text style={styles.fallbackTitle}>Driver map</Text>
      <Text style={styles.fallbackBody}>
        The live Mapbox map runs on iOS and Android. Open this screen in the native app to go
        online with location.
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.mapBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  fallbackTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.inkPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackBody: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inkSecondary,
    textAlign: 'center',
  },
});

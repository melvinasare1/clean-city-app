import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import { colors } from '@platform/shared-theme';
import type { DriverMapHandle } from './driver-map.types';

function resolveMapboxToken(): string {
  const extra = Constants.expoConfig?.extra?.mapboxAccessToken;
  const fromEnv = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
  for (const value of [fromEnv, extra]) {
    if (typeof value === 'string' && value.length > 0 && !value.includes('${')) {
      return value;
    }
  }
  return '';
}

const accessToken = resolveMapboxToken();

if (accessToken) {
  Mapbox.setAccessToken(accessToken);
}

export const DriverMap = forwardRef<DriverMapHandle>(function DriverMap(_props, ref) {
  const cameraRef = useRef<Camera>(null);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      void Location.getLastKnownPositionAsync().then((position) => {
        if (!position) {
          cameraRef.current?.setCamera({ zoomLevel: 15, animationDuration: 500 });
          return;
        }
        cameraRef.current?.setCamera({
          centerCoordinate: [position.coords.longitude, position.coords.latitude],
          zoomLevel: 15,
          animationDuration: 500,
        });
      });
    },
    resetHeading: () => {
      cameraRef.current?.setCamera({ heading: 0, animationDuration: 300 });
    },
  }));

  if (!accessToken) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.fallback]}>
        <Text style={styles.fallbackTitle}>Mapbox token missing</Text>
        <Text style={styles.fallbackBody}>
          Set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN, then rebuild the native app.
        </Text>
      </View>
    );
  }

  return (
    <MapView
      style={StyleSheet.absoluteFillObject}
      styleURL={Mapbox.StyleURL.Light}
      logoEnabled={false}
      attributionPosition={{ bottom: 8, left: 12 }}
    >
      <Camera ref={cameraRef} followUserLocation followZoomLevel={15} />
      <UserLocation visible showsUserHeadingIndicator androidRenderMode="normal" />
    </MapView>
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

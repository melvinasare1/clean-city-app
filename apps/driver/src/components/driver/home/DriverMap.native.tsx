import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import Mapbox, { Camera, MapView, UserLocation } from '@rnmapbox/maps';
import { colors } from '@platform/shared-theme';
import type { DriverMapHandle } from './driver-map.types';

const INITIAL_ZOOM = 15;

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

function toCenter(longitude: unknown, latitude: unknown): [number, number] | null {
  const lng = typeof longitude === 'number' ? longitude : Number(longitude);
  const lat = typeof latitude === 'number' ? latitude : Number(latitude);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [lng, lat];
}

function isUserCameraGesture(state: {
  gestures?: { isGestureActive?: boolean };
  properties?: { isUserInteraction?: boolean };
}): boolean {
  return (
    state.gestures?.isGestureActive === true ||
    state.properties?.isUserInteraction === true
  );
}

export const DriverMap = forwardRef<DriverMapHandle>(function DriverMap(_props, ref) {
  const cameraRef = useRef<Camera>(null);
  const mapLoadedRef = useRef(false);
  const initialCenterRef = useRef<[number, number] | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(true);

  const adoptCenter = (center: [number, number]) => {
    if (initialCenterRef.current) return;
    initialCenterRef.current = center;
    setInitialCenter(center);
  };

  const snapTo = (center: [number, number]) => {
    cameraRef.current?.setCamera({
      centerCoordinate: center,
      zoomLevel: INITIAL_ZOOM,
      animationMode: 'none',
      animationDuration: 0,
    });
    if (mapLoadedRef.current) {
      setMapVisible(true);
    }
  };

  useEffect(() => {
    let cancelled = false;

    void Location.getLastKnownPositionAsync()
      .then((position) => {
        if (cancelled || !position) return;
        const center = toCenter(position.coords.longitude, position.coords.latitude);
        if (!center) return;
        adoptCenter(center);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialCenter) return;
    snapTo(initialCenter);
  }, [initialCenter]);

  useImperativeHandle(ref, () => ({
    recenter: () => {
      setIsFollowingUser(true);
      void Location.getLastKnownPositionAsync().then((position) => {
        if (!position) {
          cameraRef.current?.setCamera({
            zoomLevel: INITIAL_ZOOM,
            animationMode: 'none',
            animationDuration: 0,
          });
          return;
        }
        const center = toCenter(position.coords.longitude, position.coords.latitude);
        if (!center) return;
        snapTo(center);
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

  const cameraProps = !mapVisible && initialCenter
    ? {
        centerCoordinate: initialCenter,
        zoomLevel: INITIAL_ZOOM,
        animationDuration: 0 as const,
        animationMode: 'none' as const,
      }
    : {
        animationDuration: 0 as const,
        animationMode: 'none' as const,
      };

  return (
    <View style={StyleSheet.absoluteFillObject}>
      <View style={[StyleSheet.absoluteFillObject, styles.placeholder]} pointerEvents="none" />
      <MapView
        style={[StyleSheet.absoluteFillObject, !mapVisible && styles.hiddenMap]}
        styleURL={Mapbox.StyleURL.Light}
        logoEnabled={false}
        attributionPosition={{ bottom: 8, left: 12 }}
        onCameraChanged={(state) => {
          if (!isUserCameraGesture(state)) return;
          setIsFollowingUser(false);
        }}
        onDidFinishLoadingMap={() => {
          mapLoadedRef.current = true;
          const center = initialCenterRef.current;
          if (center) {
            snapTo(center);
          }
        }}
      >
        {initialCenter ? (
          <Camera
            ref={cameraRef}
            defaultSettings={{
              centerCoordinate: initialCenter,
              zoomLevel: INITIAL_ZOOM,
              animationDuration: 0,
              animationMode: 'none',
            }}
            followUserLocation={mapVisible && isFollowingUser}
            {...cameraProps}
          />
        ) : null}
        <UserLocation
          visible={mapVisible}
          showsUserHeadingIndicator
          androidRenderMode="normal"
          onUpdate={(location) => {
            const next = toCenter(location?.coords?.longitude, location?.coords?.latitude);
            if (!next) return;
            if (!initialCenterRef.current) {
              adoptCenter(next);
            }
          }}
        />
      </MapView>
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: colors.mapBg,
  },
  hiddenMap: {
    opacity: 0,
  },
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

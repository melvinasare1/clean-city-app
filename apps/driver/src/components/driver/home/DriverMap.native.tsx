import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import Mapbox, {
  Camera,
  LineLayer,
  MapView,
  PointAnnotation,
  ShapeSource,
  UserLocation,
} from '@rnmapbox/maps';
import { colors } from '@platform/shared-theme';
import { useMapboxDrivingRoute } from '@/hooks/useMapboxDrivingRoute';
import { resolveMapboxToken } from '@/lib/mapbox-access-token';
import { formatAwayLabel } from '@/lib/mapbox-driving-route';
import type { DriverMapHandle, DriverMapProps } from './driver-map.types';

const INITIAL_ZOOM = 15;

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

export const DriverMap = forwardRef<DriverMapHandle, DriverMapProps>(function DriverMap(
  { pickupCoordinate = null, onRouteAwayLabelChange },
  ref
) {
  const cameraRef = useRef<Camera>(null);
  const mapLoadedRef = useRef(false);
  const initialCenterRef = useRef<[number, number] | null>(null);
  const [initialCenter, setInitialCenter] = useState<[number, number] | null>(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [driverCoordinate, setDriverCoordinate] = useState<[number, number] | null>(null);
  const framedPickupKeyRef = useRef<string | null>(null);
  const pickupCoordinateRef = useRef(pickupCoordinate);
  const driverCoordinateRef = useRef(driverCoordinate);
  pickupCoordinateRef.current = pickupCoordinate;
  driverCoordinateRef.current = driverCoordinate;
  const route = useMapboxDrivingRoute(driverCoordinate, pickupCoordinate, accessToken);

  useEffect(() => {
    console.log('[DriverMap] pickupCoordinate', pickupCoordinate);
  }, [pickupCoordinate]);

  useEffect(() => {
    onRouteAwayLabelChange?.(
      route ? formatAwayLabel(route.distanceMeters, route.durationSeconds) : null
    );
  }, [onRouteAwayLabelChange, route]);

  const pickupKey = (coordinate: [number, number] | null) =>
    coordinate ? `${coordinate[0]},${coordinate[1]}` : null;

  const fitDriverAndPickup = (
    driver: [number, number],
    pickup: [number, number],
    extraCoordinates: [number, number][] = []
  ) => {
    const points = [driver, pickup, ...extraCoordinates];
    let west = Math.min(...points.map((point) => point[0]));
    let east = Math.max(...points.map((point) => point[0]));
    let south = Math.min(...points.map((point) => point[1]));
    let north = Math.max(...points.map((point) => point[1]));
    if (east - west < 0.002) {
      west -= 0.001;
      east += 0.001;
    }
    if (north - south < 0.002) {
      south -= 0.001;
      north += 0.001;
    }
    cameraRef.current?.fitBounds(
      [east, north],
      [west, south],
      [80, 40, 280, 40],
      500
    );
    if (mapLoadedRef.current) {
      setMapVisible(true);
    }
  };

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
        setDriverCoordinate(center);
        adoptCenter(center);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialCenter) return;
    if (pickupCoordinate && driverCoordinate) return;
    snapTo(initialCenter);
  }, [driverCoordinate, initialCenter, pickupCoordinate]);

  useEffect(() => {
    if (!pickupCoordinate) {
      framedPickupKeyRef.current = null;
      return;
    }
    if (!driverCoordinate || !mapLoadedRef.current) return;
    const key = `${pickupKey(pickupCoordinate)}:${route?.source ?? 'pending'}`;
    if (framedPickupKeyRef.current === key) return;
    framedPickupKeyRef.current = key;
    setIsFollowingUser(false);
    fitDriverAndPickup(
      driverCoordinate,
      pickupCoordinate,
      route?.geometry.coordinates ?? []
    );
  }, [driverCoordinate, mapVisible, pickupCoordinate, route]);

  useImperativeHandle(
    ref,
    () => ({
      recenter: () => {
        framedPickupKeyRef.current = pickupKey(pickupCoordinate) ?? 'user-follow';
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
          setDriverCoordinate(center);
          snapTo(center);
        });
      },
    }),
    [pickupCoordinate]
  );

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

  const routeLine = route
    ? {
        type: 'Feature' as const,
        properties: {},
        geometry: route.geometry,
      }
    : null;

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
          const pickup = pickupCoordinateRef.current;
          const driver = driverCoordinateRef.current;
          if (pickup && driver) {
            const key = pickupKey(pickup);
            if (framedPickupKeyRef.current !== key) {
              framedPickupKeyRef.current = key;
              setIsFollowingUser(false);
              fitDriverAndPickup(driver, pickup, route?.geometry.coordinates ?? []);
              return;
            }
          }
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
            setDriverCoordinate(next);
            if (!initialCenterRef.current) {
              adoptCenter(next);
            }
          }}
        />
        {routeLine ? (
          <ShapeSource id="driver-to-pickup" shape={routeLine}>
            <LineLayer
              id="driver-to-pickup-line"
              style={{
                lineColor: colors.signalRed,
                lineWidth: 3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}
        {pickupCoordinate ? (
          <PointAnnotation
            id="pickup-pin"
            coordinate={pickupCoordinate}
            anchor={{ x: 0.5, y: 1 }}
            title="Pickup"
          >
            <View style={styles.pickupPin} collapsable={false}>
              <View style={styles.pickupPinHead} />
              <View style={styles.pickupPinStem} />
            </View>
          </PointAnnotation>
        ) : null}
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
  pickupPin: {
    alignItems: 'center',
    width: 22,
  },
  pickupPinHead: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.signalRed,
    borderWidth: 2.5,
    borderColor: colors.surfaceWhite,
  },
  pickupPinStem: {
    width: 3,
    height: 8,
    marginTop: -1,
    backgroundColor: colors.signalRed,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});

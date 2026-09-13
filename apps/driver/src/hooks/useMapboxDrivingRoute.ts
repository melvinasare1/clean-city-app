import { useEffect, useRef, useState } from 'react';
import {
  fetchMapboxDrivingRoute,
  haversineMeters,
  straightLineFallback,
  type DrivingRouteResult,
  type LngLat,
} from '@/lib/mapbox-driving-route';

const REFETCH_AFTER_METERS = 200;

function pickupKey(pickup: LngLat | null): string | null {
  return pickup ? `${pickup[0]},${pickup[1]}` : null;
}

export function useMapboxDrivingRoute(
  driver: LngLat | null,
  pickup: LngLat | null,
  accessToken: string
): DrivingRouteResult | null {
  const [route, setRoute] = useState<DrivingRouteResult | null>(null);
  const lastOriginRef = useRef<LngLat | null>(null);
  const lastPickupKeyRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!driver || !pickup) {
      requestIdRef.current += 1;
      lastOriginRef.current = null;
      lastPickupKeyRef.current = null;
      setRoute(null);
      return;
    }

    const nextPickupKey = pickupKey(pickup);
    const pickupChanged = lastPickupKeyRef.current !== nextPickupKey;
    const movedFar =
      lastOriginRef.current != null &&
      haversineMeters(lastOriginRef.current, driver) > REFETCH_AFTER_METERS;
    const shouldFetch = pickupChanged || !lastOriginRef.current || movedFar;
    if (!shouldFetch) return;

    lastOriginRef.current = driver;
    lastPickupKeyRef.current = nextPickupKey;
    const fallback = straightLineFallback(driver, pickup);
    setRoute((prev) => (pickupChanged || !prev ? fallback : prev));

    const requestId = ++requestIdRef.current;
    void fetchMapboxDrivingRoute(driver, pickup, accessToken).then((result) => {
      if (requestId !== requestIdRef.current) return;
      setRoute(result ?? fallback);
    });
  }, [accessToken, driver, pickup]);

  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
    };
  }, []);

  return route;
}

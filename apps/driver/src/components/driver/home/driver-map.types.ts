export type DriverMapHandle = {
  recenter: () => void;
};

export type DriverMapProps = {
  pickupCoordinate?: [number, number] | null;
  onRouteAwayLabelChange?: (label: string | null) => void;
};

export type DriverMapHandle = {
  recenter: () => void;
  resetHeading: () => void;
};

export type DriverMapProps = {
  pickupCoordinate?: [number, number] | null;
};

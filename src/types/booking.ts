
export type BookingStatus =
  | "pending"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";

export type TimeWindow = "morning" | "afternoon" | "evening";

export interface Bins {
  smallBags: number;
  largeBags: number;
  standardBins: number;
  wheelieBins: number;
}

export interface Booking {
  id: string;
  customerId: string;
  driverId?: string | null;
  addressDescription: string;
  bins: Bins;
  totalPrice: number;
  pickupDate: Date;
  timeWindow: TimeWindow;
  status: BookingStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

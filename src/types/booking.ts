import type { Timestamp } from "firebase/firestore";
import type { TimeWindowId } from "@/lib/time-windows";

export type BookingStatus = "pending" | "completed" | "cancelled";

export type BookingBinItem = {
  id?: string;
  type: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
};

export type Booking = {
  id: string;
  userId: string;
  date: string;
  windowId: TimeWindowId;
  windowLabel: string;
  location: string;
  items: BookingBinItem[];
  totalPrice: number;
  status: BookingStatus;
  createdAt: Timestamp | null;
};

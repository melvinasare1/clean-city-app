import type { BookingBinItem } from '@/types/booking';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

export type CustomerTabParamList = {
  CustomerHome: undefined;
  NewBooking: undefined;
  MyBookings: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: undefined;
  CreateBooking: {
    items: BookingBinItem[];
    totalPrice: number;
  };
  CompleteProfile: undefined;
};

export type OnboardingStackParamList = {
  RoleSelection: undefined;
  CompleteProfile: undefined;
};
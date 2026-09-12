import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BookingBinItem } from '@platform/shared-types';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type DriverTabParamList = {
  Orders: undefined;
  Earnings: undefined;
  Messages: undefined;
  Profile: undefined;
};

export type DriverStackParamList = {
  DriverTabs: NavigatorScreenParams<DriverTabParamList> | undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
  DailyEarningsDetails: undefined;
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
  BookingDetail: {
    kind: 'subscription' | 'booking';
    id: string;
  };
  CompleteProfile: undefined;
  PaymentCallback: {
    reference: string;
  };
  PrivacyPolicy: undefined;
  TermsAndConditions: undefined;
  ReferralProgram: undefined;
  RecyclingGuides: undefined;
};

export type OnboardingStackParamList = {
  RoleSelection: undefined;
  CompleteProfile: undefined;
};

export type AdminStackParamList = {
  AdminPush: undefined;
  AdminJobs: undefined;
};
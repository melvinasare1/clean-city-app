import type { NavigatorScreenParams } from '@react-navigation/native';
import type { BookingBinItem } from '@platform/shared-types';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type NewBookingParams = {
  prefillItems?: BookingBinItem[];
  nonce?: number;
};

export type DriverStackParamList = {
  DriverHome: undefined;
  DriverJobList: undefined;
  DriverJobDetail: { jobId: string };
};

export type CustomerTabParamList = {
  CustomerHome: undefined;
  MyBookings: undefined;
  CustomerProfile: undefined;
  CustomerHelp: undefined;
};

export type CustomerStackParamList = {
  CustomerTabs: NavigatorScreenParams<CustomerTabParamList> | undefined;
  NewBooking: NewBookingParams | undefined;
  CreateBooking: {
    items: BookingBinItem[];
    totalPrice: number;
  };
  PricingPlans: undefined;
  Store: undefined;
  Cart: undefined;
  BookingDetail: {
    kind: 'subscription' | 'booking';
    id: string;
  };
  BookingsList: {
    listKind: 'upcoming' | 'past';
    typeFilter: 'all' | 'subscription' | 'one_off';
  };
  CompleteProfile:
    | {
        pickup?: {
          address: string;
          location: { lat: number; lng: number };
        };
      }
    | undefined;
  SetPickupLocation:
    | {
        initialAddress?: string;
        initialLocation?: { lat: number; lng: number } | null;
        /** Persist to profiles/{uid} and return, instead of CompleteProfile. */
        saveToProfile?: boolean;
      }
    | undefined;
  PaymentMethods: undefined;
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
  AdminPricing: undefined;
};
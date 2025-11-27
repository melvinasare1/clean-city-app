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

export type CustomerStackParamList = {
  CustomerHome: undefined;
  NewBooking: undefined;
  BookingList: undefined;
};

export type OnboardingStackParamList = {
  RoleSelection: undefined;
  CompleteProfile: undefined;
};
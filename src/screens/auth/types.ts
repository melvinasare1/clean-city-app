import { NativeStackNavigationProp } from "@react-navigation/native-stack";

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

export type LoginScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    "Login" | "Signup" | "ForgotPassword"
  >;
};

export type SignupScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    "Login" | "Signup" | "ForgotPassword"
  >;
};

export type ForgotPasswordScreenProps = {
  navigation: NativeStackNavigationProp<
    AuthStackParamList,
    "Login" | "Signup" | "ForgotPassword"
  >;
};

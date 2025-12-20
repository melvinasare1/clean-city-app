// Centralized React Native Firebase setup for CleanCityApp.
// Uses @react-native-firebase/app, @react-native-firebase/auth,
// @react-native-firebase/analytics and @react-native-firebase/firestore.
//
// NOTE:
// - Requires an Expo dev client / EAS build (does NOT work in Expo Go).
// - Ensure GoogleService-Info.plist (iOS) and google-services.json (Android)
//   are correctly configured in app.json.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - native-only modules, not available in web type resolution
import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import analytics, {
  FirebaseAnalyticsTypes,
} from "@react-native-firebase/analytics";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import firestore, {
  FirebaseFirestoreTypes,
} from "@react-native-firebase/firestore";

export const firebaseAuth = auth();
export const firebaseAnalytics = analytics();
export const firebaseDb = firestore();

export type RNFirebaseUser = FirebaseAuthTypes.User | null;
export type RNFirebaseUnsubscribe = () => void;
export type RNFirebaseTimestamp = FirebaseFirestoreTypes.Timestamp;

export const signIn = (email: string, password: string) =>
  firebaseAuth.signInWithEmailAndPassword(email, password);

export const signUp = (email: string, password: string) =>
  firebaseAuth.createUserWithEmailAndPassword(email, password);

export const signOutUser = () => firebaseAuth.signOut();

export const onUserChanged = (
  cb: (user: RNFirebaseUser) => void
): RNFirebaseUnsubscribe => firebaseAuth.onAuthStateChanged(cb);

export const trackScreen = async (screenName: string) => {
  await firebaseAnalytics.logScreenView({
    screen_name: screenName,
    screen_class: screenName,
  });
};

export const trackEvent = async (
  name: string,
  params?: Record<string, any>
) => {
  await firebaseAnalytics.logEvent(name as any, params);
};



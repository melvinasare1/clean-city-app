// Firebase Web SDK setup for CleanCityApp.
// Uses Firebase v9+ modular SDK for Auth, Firestore, and Storage.
//
// NOTE:
// - Works with Expo (including Expo Go) - no native modules required.
// - Auth persistence uses AsyncStorage on native, default on web.
// - Requires environment variables:
//   - EXPO_PUBLIC_FIREBASE_API_KEY
//   - EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
//   - EXPO_PUBLIC_FIREBASE_PROJECT_ID
//   - EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
//   - EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
//   - EXPO_PUBLIC_FIREBASE_APP_ID

import { Platform } from "react-native";
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Firebase configuration from environment variables
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Validate required config
if (
  !firebaseConfig.apiKey ||
  !firebaseConfig.authDomain ||
  !firebaseConfig.projectId
) {
  throw new Error(
    "Missing required Firebase config. Please set EXPO_PUBLIC_FIREBASE_* environment variables."
  );
}

// Initialize Firebase app (singleton)
let firebaseApp: FirebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

// Initialize Auth with AsyncStorage persistence on native
let auth: Auth;
if (Platform.OS === "web") {
  auth = getAuth(firebaseApp);
} else {
  // Use initializeAuth for native to set persistence
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch (error: any) {
    // If already initialized, get the existing instance
    if (error.code === "auth/already-initialized") {
      auth = getAuth(firebaseApp);
    } else {
      throw error;
    }
  }
}

// Initialize Firestore
const db: Firestore = getFirestore(firebaseApp);

// Initialize Storage
const storage: FirebaseStorage = getStorage(firebaseApp);

// Export Firebase instances
export { firebaseApp, auth, db, storage };

// Export types for compatibility
export type FirebaseUser = import("firebase/auth").User | null;
export type FirebaseUnsubscribe = () => void;
export type FirebaseTimestamp = import("firebase/firestore").Timestamp;

// Legacy type aliases for backward compatibility
export type RNFirebaseUser = FirebaseUser;
export type RNFirebaseUnsubscribe = FirebaseUnsubscribe;
export type RNFirebaseTimestamp = FirebaseTimestamp;

// Compatibility exports (matching old RNFirebase API)
export const firebaseAuth = auth;
export const firebaseDb = db;

// Compatibility wrapper functions (for backward compatibility)
export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export const onUserChanged = (
  cb: (user: FirebaseUser) => void
): FirebaseUnsubscribe => onAuthStateChanged(auth, cb);

// Re-export commonly used Firebase functions for convenience
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type User,
} from "firebase/auth";

export {
  doc,
  collection,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  deleteField,
  type DocumentReference,
  type CollectionReference,
  type Query,
  type Timestamp,
} from "firebase/firestore";

export {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  type StorageReference,
} from "firebase/storage";

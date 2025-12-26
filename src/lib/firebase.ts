// Firebase Web SDK setup for CleanCityApp.
// Uses Firebase v9+ modular SDK for Auth, Firestore, and Storage.
//
// NOTE:
// - Works with Expo (including Expo Go) - no native modules required.
// - Auth persistence is handled automatically by Firebase Web SDK.

import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type Auth,
} from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

// Firebase configuration
// Note: These are client-side credentials and are safe to include in the app bundle.
// For production, consider using environment variables for easier management across environments.
const firebaseConfig = {
  apiKey: "AIzaSyA4ACR0egzLljVyn-hJJOKVmejz2hnhMio",
  authDomain: "clean-city-app-f9d73.firebaseapp.com",
  databaseURL: "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "clean-city-app-f9d73",
  storageBucket: "clean-city-app-f9d73.firebasestorage.app",
  messagingSenderId: "430221189966",
  appId: "1:430221189966:web:72e3149c238f4f6557b41f",
  measurementId: "G-YETSFL2EMK", // Analytics (not used, but included for completeness)
};

// Initialize Firebase app (singleton)
let firebaseApp: FirebaseApp;
if (getApps().length === 0) {
  firebaseApp = initializeApp(firebaseConfig);
} else {
  firebaseApp = getApps()[0];
}

// Initialize Auth
// Note: Firebase Web SDK handles persistence automatically on both web and React Native
const auth: Auth = getAuth(firebaseApp);

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

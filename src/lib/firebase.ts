// Firebase Web SDK setup for CleanCityApp (Expo-friendly).
// Firebase v9+ modular SDK for Auth, Firestore, Storage.
// - Web: getAuth()
// - React Native: initializeAuth() with AsyncStorage persistence

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  type Auth,
  type User as FirebaseUserType,
} from "firebase/auth";

import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA4ACR0egzLljVyn-hJJOKVmejz2hnhMio",
  authDomain: "clean-city-app-f9d73.firebaseapp.com",
  databaseURL: "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "clean-city-app-f9d73",
  storageBucket: "clean-city-app-f9d73.firebasestorage.app",
  messagingSenderId: "430221189966",
  appId: "1:430221189966:web:72e3149c238f4f6557b41f",
};

const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Auth with persistence on native
let auth: Auth;

if (Platform.OS === "web") {
  auth = getAuth(firebaseApp);
} else {
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    // In dev/hot reload auth may already be initialized
    auth = getAuth(firebaseApp);
  }
}

// ✅ Firestore with offline persistence enabled
let db: Firestore;

try {
  // Initialize Firestore with persistent cache for instant loading
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  console.log('[Firestore] ✅ Initialized with persistent cache');
} catch (error) {
  // In dev/hot reload, Firestore may already be initialized
  console.log('[Firestore] Using existing Firestore instance');
  db = getFirestore(firebaseApp);
}

const storage: FirebaseStorage = getStorage(firebaseApp);

export { firebaseApp, auth, db, storage };

// Types
export type FirebaseUser = FirebaseUserType | null;
export type FirebaseUnsubscribe = () => void;

// Backward compat aliases
export const firebaseAuth = auth;
export const firebaseDb = db;

// Convenience wrappers
export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export const onUserChanged = (cb: (user: FirebaseUser) => void): FirebaseUnsubscribe =>
  onAuthStateChanged(auth, cb);

// Re-exports
export {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
};
export type { FirebaseUserType as User };

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

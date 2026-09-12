// Firebase Web SDK setup shared by the customer and driver Expo apps.
// Both apps talk to the SAME Firebase project — only the clients are split.
// Prefer EXPO_PUBLIC_* env vars; fall back to the existing project config so
// local/dev builds keep working before EAS secrets are wired per app.

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
import { getDatabase, type Database } from "firebase/database";
import { getFunctions, type Functions } from "firebase/functions";

function env(name: string, fallback: string): string {
  const value = process.env[name];
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  return fallback;
}

const firebaseConfig = {
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY", "AIzaSyA4ACR0egzLljVyn-hJJOKVmejz2hnhMio"),
  authDomain: env(
    "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
    "clean-city-app-f9d73.firebaseapp.com"
  ),
  databaseURL: env(
    "EXPO_PUBLIC_FIREBASE_DATABASE_URL",
    "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app"
  ),
  projectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID", "clean-city-app-f9d73"),
  storageBucket: env(
    "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
    "clean-city-app-f9d73.firebasestorage.app"
  ),
  messagingSenderId: env(
    "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
    "430221189966"
  ),
  appId: env(
    "EXPO_PUBLIC_FIREBASE_APP_ID",
    "1:430221189966:web:72e3149c238f4f6557b41f"
  ),
};

const firebaseApp: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let auth: Auth;

if (Platform.OS === "web") {
  auth = getAuth(firebaseApp);
} else {
  try {
    auth = initializeAuth(firebaseApp, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    auth = getAuth(firebaseApp);
  }
}

let db: Firestore;

try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
  console.log("[Firestore] ✅ Initialized with persistent cache");
} catch {
  console.log("[Firestore] Using existing Firestore instance");
  db = getFirestore(firebaseApp);
}

const storage: FirebaseStorage = getStorage(firebaseApp);
const rtdb: Database = getDatabase(firebaseApp);
const functions: Functions = getFunctions(firebaseApp, "europe-west2");

export { firebaseApp, auth, db, storage, rtdb, functions };

export type FirebaseUser = FirebaseUserType | null;
export type FirebaseUnsubscribe = () => void;

export const firebaseAuth = auth;
export const firebaseDb = db;

export const signIn = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password);

export const signUp = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password);

export const signOutUser = () => signOut(auth);

export const onUserChanged = (cb: (user: FirebaseUser) => void): FirebaseUnsubscribe =>
  onAuthStateChanged(auth, cb);

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


import { initializeApp, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA4ACR0egzLljVyn-hJJOKVmejz2hnhMio",
  authDomain: "clean-city-app-f9d73.firebaseapp.com",
  databaseURL:
    "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "clean-city-app-f9d73",
  storageBucket: "clean-city-app-f9d73.firebasestorage.app",
  messagingSenderId: "430221189966",
  appId: "1:430221189966:web:72e3149c238f4f6557b41f",
  measurementId: "G-YETSFL2EMK",
};

export const firebaseApp: FirebaseApp = initializeApp(firebaseConfig);

export const auth: Auth = getAuth(firebaseApp);

export const db: Firestore = getFirestore(firebaseApp);

export default firebaseApp;

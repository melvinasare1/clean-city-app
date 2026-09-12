/**
 * Shared Firebase Admin initialization for API routes.
 */
import admin from "firebase-admin";

if (!admin.apps.length) {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        databaseURL:
          process.env.FIREBASE_DATABASE_URL ||
          "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app",
      });
    } catch (error) {
      console.error("Failed to parse Firebase service account JSON:", error);
    }
  } else {
    console.warn(
      "FIREBASE_SERVICE_ACCOUNT_JSON not configured - Firebase features unavailable"
    );
  }
}

export function getFirestore(): admin.firestore.Firestore {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }
  return admin.firestore();
}

export function getRealtimeDatabase(): admin.database.Database {
  if (!admin.apps.length) {
    throw new Error("Firebase Admin not initialized");
  }
  return admin.database();
}

export const FieldValue = admin.firestore.FieldValue;

export { admin };

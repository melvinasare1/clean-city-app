import admin from "firebase-admin";

/**
 * This uses GOOGLE_APPLICATION_CREDENTIALS by default.
 * Set it in your environment to point to your service account JSON.
 */
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

export const firestore = admin.firestore();
export const FieldValue = admin.firestore.FieldValue;



"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.admin = exports.FieldValue = void 0;
exports.getFirestore = getFirestore;
exports.getRealtimeDatabase = getRealtimeDatabase;
/**
 * Shared Firebase Admin initialization for API routes.
 */
const firebase_admin_1 = __importDefault(require("firebase-admin"));
exports.admin = firebase_admin_1.default;
if (!firebase_admin_1.default.apps.length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
        try {
            const serviceAccount = JSON.parse(serviceAccountJson);
            firebase_admin_1.default.initializeApp({
                credential: firebase_admin_1.default.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL ||
                    "https://clean-city-app-f9d73-default-rtdb.europe-west1.firebasedatabase.app",
            });
        }
        catch (error) {
            console.error("Failed to parse Firebase service account JSON:", error);
        }
    }
    else {
        console.warn("FIREBASE_SERVICE_ACCOUNT_JSON not configured - Firebase features unavailable");
    }
}
function getFirestore() {
    if (!firebase_admin_1.default.apps.length) {
        throw new Error("Firebase Admin not initialized");
    }
    return firebase_admin_1.default.firestore();
}
function getRealtimeDatabase() {
    if (!firebase_admin_1.default.apps.length) {
        throw new Error("Firebase Admin not initialized");
    }
    return firebase_admin_1.default.database();
}
exports.FieldValue = firebase_admin_1.default.firestore.FieldValue;

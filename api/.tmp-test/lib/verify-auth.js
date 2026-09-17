"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyAuthHeader = verifyAuthHeader;
const firebase_admin_1 = require("./firebase-admin");
async function verifyAuthHeader(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return null;
    }
    const token = authHeader.slice('Bearer '.length).trim();
    if (!token) {
        return null;
    }
    if (!firebase_admin_1.admin.apps.length) {
        console.error('Firebase Admin not initialized');
        return null;
    }
    try {
        const decoded = await firebase_admin_1.admin.auth().verifyIdToken(token);
        return decoded.uid;
    }
    catch {
        return null;
    }
}

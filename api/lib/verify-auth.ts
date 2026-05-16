import type { VercelRequest } from '@vercel/node';
import { admin } from './firebase-admin';

export async function verifyAuthHeader(
  req: VercelRequest
): Promise<string | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return null;
  }

  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    return null;
  }
}

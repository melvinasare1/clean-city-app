import admin from 'firebase-admin';

const ORDERS_COLLECTION = 'orders';

export interface StoreOrderData {
  id: string;
  userId: string;
  userEmail?: string;
  total: number;
  payment?: {
    status?: string;
    reference?: string;
  };
  items?: unknown[];
  deliveryAddress?: string;
  [key: string]: unknown;
}

export async function getStoreOrderById(
  orderId: string
): Promise<StoreOrderData | null> {
  if (!admin.apps.length) {
    throw new Error('Firebase Admin not initialized');
  }

  const snapshot = await admin
    .firestore()
    .collection(ORDERS_COLLECTION)
    .doc(orderId)
    .get();

  if (!snapshot.exists) return null;

  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<StoreOrderData, 'id'>),
  };
}

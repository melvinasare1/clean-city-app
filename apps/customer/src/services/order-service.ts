import { collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@platform/shared-firebase';
import { ORDERS_COLLECTION } from '@/lib/orders';
import { setDocAtPath } from '@/lib/utils';
import { initializePayment } from '@/services/payments';
import type { StoreOrder, StoreOrderItem } from '@/types/order';

type CreateStoreOrderParams = {
  userId: string;
  userEmail?: string;
  items: StoreOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
};

export const createStoreOrder = async ({
  userId,
  userEmail,
  items,
  subtotal,
  deliveryFee,
  total,
  deliveryAddress,
}: CreateStoreOrderParams): Promise<string> => {
  const ordersRef = collection(db, ORDERS_COLLECTION);
  const newDocRef = doc(ordersRef);
  const orderId = newDocRef.id;

  await setDocAtPath(
    [ORDERS_COLLECTION, orderId],
    {
      userId,
      ...(userEmail ? { userEmail } : {}),
      items,
      subtotal,
      deliveryFee,
      total,
      deliveryAddress,
      paymentMethod: 'momo',
      status: 'pending',
      payment: {
        status: 'unpaid',
      },
    },
    {
      merge: false,
      addTimestamps: true,
    }
  );

  return orderId;
};

export const getStoreOrderById = async (
  orderId: string
): Promise<StoreOrder | null> => {
  const snapshot = await getDoc(doc(db, ORDERS_COLLECTION, orderId));
  if (!snapshot.exists()) return null;

  const data = snapshot.data() as Partial<Omit<StoreOrder, 'id'>>;
  return {
    id: snapshot.id,
    userId: data.userId ?? '',
    userEmail: data.userEmail,
    items: data.items ?? [],
    subtotal: data.subtotal ?? 0,
    deliveryFee: data.deliveryFee ?? 0,
    total: data.total ?? 0,
    deliveryAddress: data.deliveryAddress ?? '',
    paymentMethod: 'momo',
    status: (data.status ?? 'pending') as StoreOrder['status'],
    payment: data.payment ?? { status: 'unpaid' },
  };
};

/**
 * Same Paystack initialize path as bookings (`paymentType: "one_time"`),
 * with `orderId` instead of `bookingId`.
 */
export const initiatePaymentForOrder = async (
  orderId: string
): Promise<{ authorizationUrl: string; reference: string }> => {
  const order = await getStoreOrderById(orderId);
  if (!order) {
    throw new Error('Order not found');
  }
  if (order.payment.status === 'paid') {
    throw new Error('Order is already paid');
  }

  const paymentInit = await initializePayment({
    paymentType: 'one_time',
    orderId,
  });

  if (!paymentInit.authorizationUrl) {
    throw new Error('Payment provider did not return authorization URL');
  }
  if (!paymentInit.reference) {
    throw new Error('Payment provider did not return payment reference');
  }

  const oldReference = order.payment.reference;
  const referenceHistory = [...(order.payment.referenceHistory || [])];
  if (
    oldReference &&
    oldReference !== paymentInit.reference &&
    order.payment.status !== 'paid' &&
    !referenceHistory.includes(oldReference)
  ) {
    referenceHistory.push(oldReference);
  }

  const paymentUpdate: StoreOrder['payment'] = {
    status: 'initiated',
    reference: paymentInit.reference,
    authorizationUrl: paymentInit.authorizationUrl,
    amount: order.total,
    ...(referenceHistory.length > 0 ? { referenceHistory } : {}),
  };

  await setDocAtPath(
    [ORDERS_COLLECTION, orderId],
    { payment: paymentUpdate },
    { merge: true, addTimestamps: false }
  );

  return {
    authorizationUrl: paymentInit.authorizationUrl,
    reference: paymentInit.reference,
  };
};

export const markStoreOrderAsPaid = async (
  orderId: string,
  paymentReference: string
): Promise<void> => {
  await setDocAtPath(
    [ORDERS_COLLECTION, orderId],
    {
      status: 'paid',
      payment: {
        status: 'paid',
        reference: paymentReference,
        paidAt: serverTimestamp(),
      },
    },
    { merge: true, addTimestamps: true }
  );
};

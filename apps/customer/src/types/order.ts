export type StoreOrderPaymentMethod = 'momo';

export type StoreOrderStatus = 'pending' | 'paid' | 'cancelled';

export type StoreOrderItem = {
  productId: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
};

export type StoreOrder = {
  id: string;
  userId: string;
  userEmail?: string;
  items: StoreOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryAddress: string;
  paymentMethod: StoreOrderPaymentMethod;
  status: StoreOrderStatus;
  payment: {
    status: 'unpaid' | 'initiated' | 'paid';
    reference?: string;
    authorizationUrl?: string;
    amount?: number;
    referenceHistory?: string[];
  };
};

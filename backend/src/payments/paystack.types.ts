export type TransactionStatus = "success" | "failed" | "abandoned" | "pending";

export interface InitializeTransactionBody {
  email: string;
  amount: number; // in app currency (e.g. GHS)
  metadata?: Record<string, any>; // e.g. { userId, bookingId }
}

export interface InitializeTransactionResponse {
  authorization_url: string;
  access_code: string;
  reference: string;
}

export interface VerifyTransactionResult {
  status: TransactionStatus;
  reference: string;
  amount: number; // in app currency units
  currency: string;
  statusMessage?: string;
  metadata?: Record<string, any>;
  rawPaystack: any;
}

export interface TransactionRecord {
  userId?: string | null;
  bookingId?: string | null;
  reference: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  rawPaystack?: any;
  createdAt: FirebaseFirestore.FieldValue;
  updatedAt: FirebaseFirestore.FieldValue;
}



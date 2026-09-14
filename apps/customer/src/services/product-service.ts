import {
  collection,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@platform/shared-firebase';
import {
  normalizeStoreProduct,
  PLACEHOLDER_PRODUCTS,
  PRODUCTS_COLLECTION,
  sortStoreProducts,
} from '@/lib/products';
import type { StoreProduct } from '@/types/product';

function productWritePayload(product: StoreProduct, extra?: Record<string, unknown>) {
  return {
    name: product.name,
    description: product.description,
    price: product.price,
    imageUrl: product.imageUrl,
    category: product.category,
    enabled: product.enabled,
    sortOrder: product.sortOrder,
    pricePlaceholder: product.pricePlaceholder,
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

export async function saveStoreProduct(
  product: StoreProduct,
  updatedBy?: string | null
): Promise<void> {
  await setDoc(
    doc(db, PRODUCTS_COLLECTION, product.id),
    productWritePayload(
      product,
      updatedBy ? { updatedBy } : undefined
    ),
    { merge: true }
  );
}

export async function seedPlaceholderProductsToFirestore(): Promise<number> {
  const batch = writeBatch(db);
  for (const product of PLACEHOLDER_PRODUCTS) {
    batch.set(
      doc(db, PRODUCTS_COLLECTION, product.id),
      productWritePayload(product, { seededBy: 'admin-store-screen' }),
      { merge: true }
    );
  }
  await batch.commit();
  return PLACEHOLDER_PRODUCTS.length;
}

export function subscribeToStoreProducts(
  onUpdate: (products: StoreProduct[], fromFirestore: boolean) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = collection(db, PRODUCTS_COLLECTION);

  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate(PLACEHOLDER_PRODUCTS, false);
        return;
      }

      const products: StoreProduct[] = [];
      snapshot.forEach((docSnap) => {
        const parsed = normalizeStoreProduct(
          docSnap.id,
          docSnap.data() as Record<string, unknown>
        );
        if (parsed) products.push(parsed);
      });

      onUpdate(
        products.length > 0 ? sortStoreProducts(products) : PLACEHOLDER_PRODUCTS,
        products.length > 0
      );
    },
    (err) => {
      console.error('[ProductService] Snapshot error:', err);
      onError?.(err as Error);
      onUpdate(PLACEHOLDER_PRODUCTS, false);
    }
  );
}

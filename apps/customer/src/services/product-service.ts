import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@platform/shared-firebase';
import {
  normalizeStoreProduct,
  PLACEHOLDER_PRODUCTS,
  PRODUCTS_COLLECTION,
  sortStoreProducts,
} from '@/lib/products';
import type { StoreProduct } from '@/types/product';

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

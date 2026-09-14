import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { PLACEHOLDER_PRODUCTS } from '@/lib/products';
import { subscribeToStoreProducts } from '@/services/product-service';
import type { StoreProduct } from '@/types/product';

type ProductsContextValue = {
  products: StoreProduct[];
  productsById: Record<string, StoreProduct>;
  loading: boolean;
  error: string | null;
  source: 'firestore' | 'placeholder';
};

const ProductsContext = createContext<ProductsContextValue | undefined>(undefined);

export const ProductsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [products, setProducts] = useState<StoreProduct[]>(PLACEHOLDER_PRODUCTS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'firestore' | 'placeholder'>('placeholder');
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    unsubscribeRef.current = subscribeToStoreProducts(
      (next, fromFirestore) => {
        setProducts(next);
        setSource(fromFirestore ? 'firestore' : 'placeholder');
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err?.message ?? 'Failed to load store catalog.');
        setProducts(PLACEHOLDER_PRODUCTS);
        setSource('placeholder');
        setLoading(false);
      }
    );

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const productsById = useMemo(() => {
    const map: Record<string, StoreProduct> = {};
    for (const product of products) {
      map[product.id] = product;
    }
    return map;
  }, [products]);

  const value = useMemo(
    () => ({ products, productsById, loading, error, source }),
    [products, productsById, loading, error, source]
  );

  return (
    <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>
  );
};

export const useProductsContext = () => {
  const context = useContext(ProductsContext);
  if (!context) {
    throw new Error('useProductsContext must be used within a ProductsProvider');
  }
  return context;
};

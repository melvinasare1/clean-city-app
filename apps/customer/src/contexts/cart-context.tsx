import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { useProductsContext } from '@/contexts/products-context';

export type CartLine = {
  productId: string;
  quantity: number;
};

type CartContextValue = {
  items: CartLine[];
  addToCart: (productId: string, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItemCount: number;
  totalPrice: number;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { productsById } = useProductsContext();
  const [items, setItems] = useState<CartLine[]>([]);

  const addToCart = useCallback((productId: string, quantity = 1) => {
    const increment = Math.max(1, Math.floor(quantity));
    setItems((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      if (!existing) {
        return [...prev, { productId, quantity: increment }];
      }
      return prev.map((line) =>
        line.productId === productId
          ? { ...line, quantity: line.quantity + increment }
          : line
      );
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((line) => line.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    const nextQty = Math.floor(quantity);
    if (nextQty <= 0) {
      setItems((prev) => prev.filter((line) => line.productId !== productId));
      return;
    }
    setItems((prev) => {
      const existing = prev.find((line) => line.productId === productId);
      if (!existing) {
        return [...prev, { productId, quantity: nextQty }];
      }
      return prev.map((line) =>
        line.productId === productId ? { ...line, quantity: nextQty } : line
      );
    });
  }, []);

  const totalItemCount = useMemo(
    () => items.reduce((sum, line) => sum + line.quantity, 0),
    [items]
  );

  const totalPrice = useMemo(
    () =>
      items.reduce((sum, line) => {
        const product = productsById[line.productId];
        if (!product || product.pricePlaceholder) return sum;
        return sum + product.price * line.quantity;
      }, 0),
    [items, productsById]
  );

  const value = useMemo(
    () => ({
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItemCount,
      totalPrice,
    }),
    [
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItemCount,
      totalPrice,
    ]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

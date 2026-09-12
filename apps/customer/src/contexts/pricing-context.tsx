import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Unsubscribe } from 'firebase/firestore';
import { DEFAULT_PRICING_CONFIG } from '@/lib/pricing';
import { subscribeToPricingConfig } from '@/services/pricing-service';
import type { PricingConfig } from '@/types/pricing';

type PricingContextValue = {
  pricing: PricingConfig;
  loading: boolean;
  error: string | null;
  source: 'firestore' | 'default';
};

const PricingContext = createContext<PricingContextValue | undefined>(undefined);

export const PricingProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [pricing, setPricing] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<'firestore' | 'default'>('default');
  const unsubscribeRef = useRef<Unsubscribe | null>(null);

  useEffect(() => {
    unsubscribeRef.current = subscribeToPricingConfig(
      (config, fromFirestore) => {
        setPricing(config);
        setSource(fromFirestore ? 'firestore' : 'default');
        setLoading(false);
        setError(null);
        if (__DEV__) {
          console.log(
            `[Pricing] ${fromFirestore ? 'Firestore' : 'built-in defaults'}`,
            {
              smallBag: config.bins.smallBag.unitPrice,
              standardBin: config.bins.standardBin.unitPrice,
              wheelieBin: config.bins.wheelieBin.unitPrice,
            }
          );
        }
      },
      (err) => {
        const message = err?.message ?? 'Failed to load pricing.';
        setError(message);
        setPricing(DEFAULT_PRICING_CONFIG);
        setSource('default');
        setLoading(false);
        if (__DEV__) {
          console.warn('[Pricing] Using built-in defaults:', message);
        }
      }
    );

    return () => {
      unsubscribeRef.current?.();
      unsubscribeRef.current = null;
    };
  }, []);

  const value = useMemo(
    () => ({ pricing, loading, error, source }),
    [pricing, loading, error, source]
  );

  return (
    <PricingContext.Provider value={value}>{children}</PricingContext.Provider>
  );
};

export const usePricingContext = () => {
  const context = useContext(PricingContext);
  if (!context) {
    throw new Error('usePricingContext must be used within a PricingProvider');
  }
  return context;
};

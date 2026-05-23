import { doc, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  DEFAULT_PRICING_CONFIG,
  normalizePricingConfig,
  PRICING_CONFIG_COLLECTION,
  PRICING_CONFIG_DOC_ID,
} from '@/lib/pricing';
import type { PricingConfig } from '@/types/pricing';

export function subscribeToPricingConfig(
  onUpdate: (config: PricingConfig, fromFirestore: boolean) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const ref = doc(db, PRICING_CONFIG_COLLECTION, PRICING_CONFIG_DOC_ID);

  return onSnapshot(
    ref,
    (snapshot) => {
      const fromFirestore = snapshot.exists();
      const config = fromFirestore
        ? normalizePricingConfig(snapshot.data() as Record<string, unknown>)
        : DEFAULT_PRICING_CONFIG;
      onUpdate(config, fromFirestore);
    },
    (err) => {
      console.error('[PricingService] Snapshot error:', err);
      onError?.(err as Error);
      onUpdate(DEFAULT_PRICING_CONFIG, false);
    }
  );
}

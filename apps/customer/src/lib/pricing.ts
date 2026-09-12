import type { BinCatalogEntry, BinPriceKey, BinPricingEntry, PricingConfig } from '@/types/pricing';

export const PRICING_CONFIG_COLLECTION = 'config';
export const PRICING_CONFIG_DOC_ID = 'pricing';

/** Static bin metadata (labels/ids). Prices come from Firestore `config/pricing`. */
export const BIN_CATALOG: BinCatalogEntry[] = [
  {
    key: 'smallBag',
    id: 'SMALL_BAG',
    label: 'Small Bags',
    description:
      'About the size of a regular grocery bag. Good for small household waste.',
  },
  {
    key: 'standardBin',
    id: 'STANDARD_BIN',
    label: 'Standard Bins',
    description:
      'Similar to a typical dustbin kept outside homes. Fits multiple large bags.',
  },
  {
    key: 'wheelieBin',
    id: 'WHEELIE_BIN',
    label: 'Wheelie Bins',
    description:
      'Large wheeled bin, like those used for zoomlion collections. Best for big clean ups or businesses.',
  },
];

const BIN_KEYS: BinPriceKey[] = ['smallBag', 'standardBin', 'wheelieBin'];

const DEFAULT_BIN_PRICES: Record<BinPriceKey, number> = {
  smallBag: 0.2,
  standardBin: 20,
  wheelieBin: 35,
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  currency: 'GHS',
  bins: BIN_KEYS.reduce(
    (acc, key) => {
      acc[key] = { unitPrice: DEFAULT_BIN_PRICES[key], enabled: true };
      return acc;
    },
    {} as Record<BinPriceKey, BinPricingEntry>
  ),
};

function parsePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function parseBinEntry(
  raw: unknown,
  fallback: BinPricingEntry
): BinPricingEntry {
  if (!raw || typeof raw !== 'object') return fallback;

  const entry = raw as Record<string, unknown>;
  const unitPrice = parsePositiveNumber(entry.unitPrice) ?? fallback.unitPrice;
  const enabled =
    typeof entry.enabled === 'boolean' ? entry.enabled : fallback.enabled;

  return { unitPrice, enabled };
}

/**
 * Normalize Firestore `config/pricing` into app pricing config.
 * Supports nested `bins.{key}` or legacy flat `{ smallBag: 20, ... }`.
 */
export function normalizePricingConfig(
  data: Record<string, unknown> | undefined
): PricingConfig {
  if (!data) return DEFAULT_PRICING_CONFIG;

  const currency =
    typeof data.currency === 'string' && data.currency.trim()
      ? data.currency.trim()
      : DEFAULT_PRICING_CONFIG.currency;

  const binsRaw = data.bins;
  const bins: Record<BinPriceKey, BinPricingEntry> = { ...DEFAULT_PRICING_CONFIG.bins };

  for (const key of BIN_KEYS) {
    const fallback = DEFAULT_PRICING_CONFIG.bins[key];

    if (binsRaw && typeof binsRaw === 'object') {
      const nested = (binsRaw as Record<string, unknown>)[key];
      if (nested != null) {
        bins[key] = parseBinEntry(nested, fallback);
        continue;
      }
    }

    const flatPrice = parsePositiveNumber(data[key]);
    if (flatPrice != null) {
      bins[key] = { ...fallback, unitPrice: flatPrice };
    }
  }

  return { currency, bins };
}

export function getEnabledBinCatalog(config: PricingConfig): BinCatalogEntry[] {
  return BIN_CATALOG.filter((bin) => config.bins[bin.key]?.enabled !== false);
}

export function getUnitPrice(config: PricingConfig, key: BinPriceKey): number {
  return config.bins[key]?.unitPrice ?? DEFAULT_PRICING_CONFIG.bins[key].unitPrice;
}

/** @deprecated Use `usePricing()` or `DEFAULT_PRICING_CONFIG` — kept for backward compatibility. */
export const PRICES = {
  smallBag: DEFAULT_PRICING_CONFIG.bins.smallBag.unitPrice,
  standardBin: DEFAULT_PRICING_CONFIG.bins.standardBin.unitPrice,
  wheelieBin: DEFAULT_PRICING_CONFIG.bins.wheelieBin.unitPrice,
};

import type { BinCatalogEntry, BinPriceKey, BinPricingEntry, PricingConfig, PricingTier } from '@/types/pricing';

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

export const DEFAULT_LOW_MULTIPLIER = 0.85;
export const DEFAULT_SURGE_MULTIPLIER = 1.3;

export const PRICING_TIERS: PricingTier[] = ['low', 'standard', 'surge'];

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  currency: 'GHS',
  bins: BIN_KEYS.reduce(
    (acc, key) => {
      acc[key] = { unitPrice: DEFAULT_BIN_PRICES[key], enabled: true };
      return acc;
    },
    {} as Record<BinPriceKey, BinPricingEntry>
  ),
  activeTier: 'standard',
  lowMultiplier: DEFAULT_LOW_MULTIPLIER,
  surgeMultiplier: DEFAULT_SURGE_MULTIPLIER,
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

function parsePricingTier(value: unknown, fallback: PricingTier): PricingTier {
  return typeof value === 'string' && (PRICING_TIERS as string[]).includes(value)
    ? (value as PricingTier)
    : fallback;
}

/** Rejects anything that isn't strictly below 1.0 — a bad doc must never make "low" pricier than standard. */
function parseLowMultiplier(value: unknown, fallback: number): number {
  const parsed = parsePositiveNumber(value);
  return parsed != null && parsed > 0 && parsed < 1.0 ? parsed : fallback;
}

/** Rejects anything that isn't strictly above 1.0 — a bad doc must never make "surge" cheaper than standard. */
function parseSurgeMultiplier(value: unknown, fallback: number): number {
  const parsed = parsePositiveNumber(value);
  return parsed != null && parsed > 1.0 ? parsed : fallback;
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

  const activeTier = parsePricingTier(data.activeTier, DEFAULT_PRICING_CONFIG.activeTier);
  const lowMultiplier = parseLowMultiplier(data.lowMultiplier, DEFAULT_PRICING_CONFIG.lowMultiplier);
  const surgeMultiplier = parseSurgeMultiplier(data.surgeMultiplier, DEFAULT_PRICING_CONFIG.surgeMultiplier);

  return { currency, bins, activeTier, lowMultiplier, surgeMultiplier };
}

export function getEnabledBinCatalog(config: PricingConfig): BinCatalogEntry[] {
  return BIN_CATALOG.filter((bin) => config.bins[bin.key]?.enabled !== false);
}

/**
 * Single funnel for demand-tier pricing math: standard is always 1x,
 * low/surge apply the config's multiplier. Every customer-facing price
 * and every booking-priced amount must go through this — never duplicate
 * the multiplier math at a call site.
 */
export function getEffectivePrice(
  basePrice: number,
  activeTier: PricingTier,
  config: Pick<PricingConfig, 'lowMultiplier' | 'surgeMultiplier'>
): number {
  const multiplier =
    activeTier === 'low'
      ? config.lowMultiplier
      : activeTier === 'surge'
        ? config.surgeMultiplier
        : 1.0;
  return basePrice * multiplier;
}

export function getUnitPrice(config: PricingConfig, key: BinPriceKey): number {
  const basePrice = config.bins[key]?.unitPrice ?? DEFAULT_PRICING_CONFIG.bins[key].unitPrice;
  return getEffectivePrice(basePrice, config.activeTier, config);
}

/** @deprecated Use `usePricing()` or `DEFAULT_PRICING_CONFIG` — kept for backward compatibility. */
export const PRICES = {
  smallBag: DEFAULT_PRICING_CONFIG.bins.smallBag.unitPrice,
  standardBin: DEFAULT_PRICING_CONFIG.bins.standardBin.unitPrice,
  wheelieBin: DEFAULT_PRICING_CONFIG.bins.wheelieBin.unitPrice,
};

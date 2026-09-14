export type BinPriceKey = 'smallBag' | 'standardBin' | 'wheelieBin';

export type BinPricingEntry = {
  unitPrice: number;
  enabled: boolean;
};

export type PricingTier = 'low' | 'standard' | 'surge';

export type PricingConfig = {
  currency: string;
  bins: Record<BinPriceKey, BinPricingEntry>;
  activeTier: PricingTier;
  lowMultiplier: number;
  surgeMultiplier: number;
};

export type BinCatalogEntry = {
  key: BinPriceKey;
  id: string;
  label: string;
  description: string;
};

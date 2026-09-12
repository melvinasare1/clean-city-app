export type BinPriceKey = 'smallBag' | 'standardBin' | 'wheelieBin';

export type BinPricingEntry = {
  unitPrice: number;
  enabled: boolean;
};

export type PricingConfig = {
  currency: string;
  bins: Record<BinPriceKey, BinPricingEntry>;
};

export type BinCatalogEntry = {
  key: BinPriceKey;
  id: string;
  label: string;
  description: string;
};

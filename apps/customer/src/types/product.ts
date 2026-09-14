export type StoreProductCategory = 'bin' | 'liner';

export type StoreProduct = {
  id: string;
  name: string;
  description: string;
  /** Unit price in GHS. Placeholder catalog rows use 0 until real prices are confirmed. */
  price: number;
  imageUrl: string;
  category: StoreProductCategory;
  enabled: boolean;
  sortOrder: number;
  /** True for seeded placeholder rows — UI shows "Price TBD" instead of GHS 0.00. */
  pricePlaceholder: boolean;
};

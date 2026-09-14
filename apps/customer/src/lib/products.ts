import type { StoreProduct, StoreProductCategory } from '@/types/product';

export const PRODUCTS_COLLECTION = 'products';

const CATEGORIES: StoreProductCategory[] = ['bin', 'liner'];

/**
 * Client fallback so the Store screen is usable before Firestore is seeded.
 * Names match the intended catalog; prices are placeholders (not for sale).
 */
export const PLACEHOLDER_PRODUCTS: StoreProduct[] = [
  {
    id: 'small-bin',
    name: 'Small Bin',
    description: '[Placeholder copy] Compact bin for everyday household waste.',
    price: 0,
    imageUrl: '',
    category: 'bin',
    enabled: true,
    sortOrder: 1,
    pricePlaceholder: true,
  },
  {
    id: 'regular-bin',
    name: 'Regular Bin',
    description: '[Placeholder copy] Standard household bin for daily collections.',
    price: 0,
    imageUrl: '',
    category: 'bin',
    enabled: true,
    sortOrder: 2,
    pricePlaceholder: true,
  },
  {
    id: 'recycle-bin',
    name: 'Recycle Bin',
    description: '[Placeholder copy] Dedicated bin for recyclable materials.',
    price: 0,
    imageUrl: '',
    category: 'bin',
    enabled: true,
    sortOrder: 3,
    pricePlaceholder: true,
  },
  {
    id: 'bin-liners-50',
    name: 'Bin Liners (50 Pack)',
    description: '[Placeholder copy] 50 liners sized for household bins.',
    price: 0,
    imageUrl: '',
    category: 'liner',
    enabled: true,
    sortOrder: 4,
    pricePlaceholder: true,
  },
  {
    id: 'bin-liners-100',
    name: 'Bin Liners (100 Pack)',
    description: '[Placeholder copy] 100 liners sized for household bins.',
    price: 0,
    imageUrl: '',
    category: 'liner',
    enabled: true,
    sortOrder: 5,
    pricePlaceholder: true,
  },
];

function parseNonNegativeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function parseCategory(value: unknown): StoreProductCategory | null {
  return typeof value === 'string' && CATEGORIES.includes(value as StoreProductCategory)
    ? (value as StoreProductCategory)
    : null;
}

export function normalizeStoreProduct(
  id: string,
  data: Record<string, unknown>
): StoreProduct | null {
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const category = parseCategory(data.category);
  const price = parseNonNegativeNumber(data.price);
  if (!name || !category || price == null) return null;

  const sortParsed = parseNonNegativeNumber(data.sortOrder);

  return {
    id,
    name,
    description: typeof data.description === 'string' ? data.description.trim() : '',
    price,
    imageUrl: typeof data.imageUrl === 'string' ? data.imageUrl.trim() : '',
    category,
    enabled: data.enabled !== false,
    sortOrder: sortParsed != null ? sortParsed : 0,
    pricePlaceholder: data.pricePlaceholder === true,
  };
}

export function sortStoreProducts(products: StoreProduct[]): StoreProduct[] {
  return [...products].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.name.localeCompare(b.name);
  });
}

export function formatStorePrice(product: StoreProduct): string {
  if (product.pricePlaceholder) return 'Price TBD';
  return `GHS ${product.price.toFixed(2)}`;
}

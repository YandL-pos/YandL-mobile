import type { PosProduct } from '../../../services/pos/types';
import type { CartItem } from './pricing';

export type CartError = 'OUT_OF_STOCK' | 'EXCEEDS_STOCK' | 'INVALID_QUANTITY';

export interface CartResult {
  items: CartItem[];
  error?: CartError;
}

// inventoryId -> quantity already in the order being edited; that stock is available to it again
export type OriginalQuantities = Record<string, number>;

export type StockFilter = 'All' | 'InStock' | 'LowStock' | 'OutOfStock';

export const LOW_STOCK_THRESHOLD = 5;

// Hidden from the product grid, as on the web POS
export const HIDDEN_PRODUCT_IDS = ['69a15d55218ec5ff9a3fe4a3'];

export const getShelfStock = (product: PosProduct) => product.availableQuantity ?? product.quantity ?? 0;

export const getAvailableStock = (product: PosProduct, originalQuantities: OriginalQuantities = {}) =>
  getShelfStock(product) + (originalQuantities[product._id] || 0);

export const filterProducts = (products: PosProduct[], stockFilter: StockFilter) =>
  products.filter((product) => {
    if (HIDDEN_PRODUCT_IDS.includes(product._id)) return false;
    const qty = getShelfStock(product);
    if (stockFilter === 'InStock') return qty > 0;
    if (stockFilter === 'LowStock') return qty > 0 && qty <= LOW_STOCK_THRESHOLD;
    if (stockFilter === 'OutOfStock') return qty <= 0;
    return true;
  });

export const getCartQty = (items: CartItem[], productId: string) =>
  items.find((item) => item.product._id === productId)?.qty ?? 0;

const replaceQty = (items: CartItem[], productId: string, qty: number) =>
  items.map((item) => (item.product._id === productId ? { ...item, qty } : item));

// Tap on a product: add one, or one more if it's already in the cart
export const addItem = (
  items: CartItem[],
  product: PosProduct,
  originalQuantities: OriginalQuantities = {},
): CartResult => {
  const available = getAvailableStock(product, originalQuantities);
  if (available <= 0) return { items, error: 'OUT_OF_STOCK' };

  const existing = items.find((item) => item.product._id === product._id);
  if (!existing) return { items: [...items, { product, qty: 1 }] };
  if (existing.qty + 1 > available) return { items, error: 'EXCEEDS_STOCK' };
  return { items: replaceQty(items, product._id, existing.qty + 1) };
};

// The +/- buttons; quantity never drops below 1 (removing is a separate action)
export const changeQty = (
  items: CartItem[],
  productId: string,
  delta: number,
  originalQuantities: OriginalQuantities = {},
): CartResult => {
  const existing = items.find((item) => item.product._id === productId);
  if (!existing) return { items };

  const nextQty = existing.qty + delta;
  if (nextQty > getAvailableStock(existing.product, originalQuantities)) {
    return { items, error: 'EXCEEDS_STOCK' };
  }
  if (nextQty < 1) return { items };
  return { items: replaceQty(items, productId, nextQty) };
};

// Typed quantity: below 1 becomes 1, above the stock is capped at the stock
export const setItemQty = (
  items: CartItem[],
  productId: string,
  qty: number,
  originalQuantities: OriginalQuantities = {},
): CartResult => {
  const existing = items.find((item) => item.product._id === productId);
  if (!existing) return { items };

  const wanted = Number.isFinite(qty) ? Math.floor(qty) : 1;
  if (wanted < 1) return { items: replaceQty(items, productId, 1) };

  const available = getAvailableStock(existing.product, originalQuantities);
  if (wanted > available) {
    return { items: replaceQty(items, productId, available), error: 'EXCEEDS_STOCK' };
  }
  return { items: replaceQty(items, productId, wanted) };
};

// Picking a wholesale tier sets the line to that tier's quantity, capped at the stock
export const applyWholesaleTier = (
  items: CartItem[],
  product: PosProduct,
  tierQuantity: number,
  originalQuantities: OriginalQuantities = {},
): CartResult => {
  const available = getAvailableStock(product, originalQuantities);
  if (available <= 0) return { items, error: 'OUT_OF_STOCK' };

  const parsedTierQty = Number(tierQuantity);
  if (!Number.isFinite(parsedTierQty) || parsedTierQty <= 0) {
    return { items, error: 'INVALID_QUANTITY' };
  }

  const requestedQty = Math.max(1, Math.floor(parsedTierQty));
  const finalQty = Math.min(requestedQty, available);
  const error: CartError | undefined = requestedQty > available ? 'EXCEEDS_STOCK' : undefined;

  const exists = items.some((item) => item.product._id === product._id);
  const nextItems = exists
    ? replaceQty(items, product._id, finalQty)
    : [...items, { product, qty: finalQty }];
  return { items: nextItems, error };
};

export const removeItem = (items: CartItem[], productId: string): CartItem[] =>
  items.filter((item) => item.product._id !== productId);

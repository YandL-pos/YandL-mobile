import type { PosProduct, WholesalePrice } from '../../../services/pos/types';

export interface CartItem {
  product: PosProduct;
  qty: number;
}

export type PriceMode = 'normal' | 'discount' | 'markup';

export interface Totals {
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  markupAmount: number;
  total: number;
}

// Whole, positive quantity; anything else counts as 0
export const getSafeQty = (qty: number) => (Number.isFinite(qty) && qty > 0 ? Math.floor(qty) : 0);

export const getSortedWholesaleTiers = (product: PosProduct): WholesalePrice[] =>
  (product.wholesalePrices || []).slice().sort((a, b) => a.quantity - b.quantity);

// Selling price, or the price of the highest wholesale tier the quantity reaches
export const getUnitPrice = (product: PosProduct, qty = 1) => {
  const basePrice = product.sellingPrice || 0;
  const eligibleTier = getSortedWholesaleTiers(product)
    .filter((tier) => qty >= tier.quantity)
    .pop();
  return eligibleTier?.price ?? basePrice;
};

export const getLineTotal = (item: CartItem) => {
  const qty = getSafeQty(item.qty);
  return getUnitPrice(item.product, qty || 1) * qty;
};

export const computeTotals = ({
  items,
  priceMode,
  discountPercent,
  markupAmount,
}: {
  items: CartItem[];
  priceMode: PriceMode;
  discountPercent: number;
  markupAmount: number;
}): Totals => {
  const itemCount = items.reduce((sum, item) => sum + getSafeQty(item.qty), 0);
  const subtotal = items.reduce((sum, item) => sum + getLineTotal(item), 0);

  if (priceMode === 'markup') {
    const markup = Number(markupAmount) || 0;
    return { itemCount, subtotal, discountAmount: 0, markupAmount: markup, total: subtotal + markup };
  }

  const percent = priceMode === 'discount' ? Number(discountPercent) || 0 : 0;
  const total = Math.round(subtotal * (1 - percent / 100));
  return {
    itemCount,
    subtotal,
    discountAmount: Math.round(subtotal - total),
    markupAmount: 0,
    total,
  };
};

// Discount calculator: a fixed MMK amount becomes the percentage the order stores.
// Returns null when the amount can't be applied (zero, negative, or more than the subtotal).
export const discountPercentFromAmount = (amount: number, subtotal: number): number | null => {
  if (!Number.isFinite(amount) || amount <= 0 || subtotal <= 0 || amount > subtotal) return null;
  return (amount / subtotal) * 100;
};

// What a markup amount is as a share of the subtotal, for the markup calculator's preview
export const markupPercentOf = (amount: number, subtotal: number) =>
  subtotal > 0 ? (amount / subtotal) * 100 : 0;

export const getChangeAmount = (paidAmount: number, total: number) => Math.max(0, paidAmount - total);

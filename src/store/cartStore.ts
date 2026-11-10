import { useMemo } from 'react';
import { create } from 'zustand';

import type { CreditPersona, PosOrder, PosProduct } from '../services/pos/types';
import {
  getFinalPaidAmount,
  Totals,
  addItem,
  applyWholesaleTier,
  CartError,
  CartItem,
  CartResult,
  changeQty,
  computeTotals,
  getInitialPaidAmount,
  getTodayDateString,
  isFoc,
  OriginalQuantities,
  PAYMENT_METHODS,
  PaymentMethod,
  PaymentType,
  PriceMode,
  removeItem,
  setItemQty,
} from '../features/pos/lib';

// The three payment choices on the checkout screen; FOC is a paid order with method FOC
export type PaymentOption = 'paid' | 'credit' | 'foc';

// What was sold, kept after the cart is cleared for the success screen and the receipt
export interface CompletedSale {
  order: PosOrder;
  items: CartItem[];
  totals: Totals;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  customer: CreditPersona | null;
  note: string;
  orderDate: string;
  completedAt: string;
}

interface CartState {
  items: CartItem[];
  originalQuantities: OriginalQuantities;
  priceMode: PriceMode;
  discountPercent: number;
  markupAmount: number;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  creditPersonId: string;
  note: string;
  orderDate: string;
  isCheckoutOpen: boolean;
  lastSale: CompletedSale | null;
  // Goes up with every sale, so the product grid knows to reload stock
  saleCount: number;

  // Cart actions return the problem to show, if any
  addProduct: (product: PosProduct) => CartError | undefined;
  changeQty: (productId: string, delta: number) => CartError | undefined;
  setQty: (productId: string, qty: number) => CartError | undefined;
  applyWholesaleTier: (product: PosProduct, tierQuantity: number) => CartError | undefined;
  removeItem: (productId: string) => void;
  // Empties the cart but keeps the chosen payment options
  clearItems: () => void;

  setPriceMode: (mode: PriceMode) => void;
  setDiscountPercent: (percent: number) => void;
  setMarkupAmount: (amount: number) => void;
  selectPaymentOption: (option: PaymentOption) => void;
  setPaymentMethod: (method: PaymentMethod) => void;
  setPaidAmount: (amount: number) => void;
  setCreditPersonId: (id: string) => void;
  setNote: (note: string) => void;
  setOrderDate: (date: string) => void;

  openCheckout: () => void;
  closeCheckout: () => void;
  completeSale: (order: PosOrder, customer: CreditPersona | null) => CompletedSale;
  reset: () => void;
}

type CartData = Pick<
  CartState,
  | 'items'
  | 'originalQuantities'
  | 'priceMode'
  | 'discountPercent'
  | 'markupAmount'
  | 'paymentType'
  | 'paymentMethod'
  | 'paidAmount'
  | 'creditPersonId'
  | 'note'
  | 'orderDate'
  | 'isCheckoutOpen'
>;

const initialData = (): CartData => ({
  items: [],
  originalQuantities: {},
  priceMode: 'normal',
  discountPercent: 0,
  markupAmount: 0,
  paymentType: 'paid',
  paymentMethod: PAYMENT_METHODS.CASH,
  paidAmount: 0,
  creditPersonId: '',
  note: '',
  orderDate: getTodayDateString(),
  isCheckoutOpen: false,
});

const totalOf = (state: Pick<CartData, 'items' | 'priceMode' | 'discountPercent' | 'markupAmount'>) =>
  computeTotals(state).total;

// While the checkout screen is open, a paid (non-FOC) order's paid amount follows the total,
// as on the web POS when making a new sale
const withSyncedPaidAmount = (state: CartData): CartData => {
  if (!state.isCheckoutOpen || state.paymentType !== 'paid' || isFoc(state.paymentMethod)) {
    return state;
  }
  return { ...state, paidAmount: Math.ceil(totalOf(state)) };
};

export const useCartStore = create<CartState>((set, get) => {
  const applyCartResult = (result: CartResult) => {
    set({ items: result.items });
    // Leaving the cart empty also closes checkout, like the web POS's cart modal
    if (result.items.length === 0) set({ isCheckoutOpen: false });
    return result.error;
  };

  const update = (patch: Partial<CartData>) => {
    set(withSyncedPaidAmount({ ...get(), ...patch }));
  };

  return {
    ...initialData(),
    lastSale: null,
    saleCount: 0,

    addProduct: (product) => applyCartResult(addItem(get().items, product, get().originalQuantities)),
    changeQty: (productId, delta) =>
      applyCartResult(changeQty(get().items, productId, delta, get().originalQuantities)),
    setQty: (productId, qty) =>
      applyCartResult(setItemQty(get().items, productId, qty, get().originalQuantities)),
    applyWholesaleTier: (product, tierQuantity) =>
      applyCartResult(applyWholesaleTier(get().items, product, tierQuantity, get().originalQuantities)),
    removeItem: (productId) => {
      applyCartResult({ items: removeItem(get().items, productId) });
    },
    clearItems: () => {
      applyCartResult({ items: [] });
    },

    setPriceMode: (priceMode) => {
      if (isFoc(get().paymentMethod)) return;
      if (priceMode === 'normal') update({ priceMode, discountPercent: 0, markupAmount: 0 });
      else if (priceMode === 'discount') update({ priceMode, markupAmount: 0 });
      else update({ priceMode, discountPercent: 0 });
    },
    setDiscountPercent: (percent) => update({ discountPercent: Number(percent) || 0 }),
    setMarkupAmount: (amount) => update({ markupAmount: Number(amount) || 0 }),

    selectPaymentOption: (option) => {
      if (option === 'paid') {
        const state = get();
        set({
          paymentType: 'paid',
          paymentMethod: PAYMENT_METHODS.CASH,
          paidAmount: Math.ceil(totalOf(state)),
        });
      } else if (option === 'credit') {
        set({ paymentType: 'credit', paymentMethod: PAYMENT_METHODS.CASH, paidAmount: 0 });
      } else {
        set({
          paymentType: 'paid',
          paymentMethod: PAYMENT_METHODS.FOC,
          paidAmount: 0,
          priceMode: 'normal',
          discountPercent: 0,
          markupAmount: 0,
        });
      }
    },
    setPaymentMethod: (paymentMethod) => {
      // FOC is left through the payment options, not by picking a method
      if (isFoc(get().paymentMethod)) return;
      update({ paymentMethod });
    },
    setPaidAmount: (amount) => {
      const value = Number(amount);
      set({ paidAmount: Number.isFinite(value) && value > 0 ? Math.ceil(value) : 0 });
    },
    setCreditPersonId: (creditPersonId) => set({ creditPersonId }),
    setNote: (note) => set({ note }),
    setOrderDate: (orderDate) => set({ orderDate }),

    openCheckout: () => {
      const state = get();
      if (state.items.length === 0) return;
      set({
        isCheckoutOpen: true,
        paidAmount: getInitialPaidAmount({
          paymentType: state.paymentType,
          paymentMethod: state.paymentMethod,
          paidAmount: state.paidAmount,
          total: totalOf(state),
        }),
      });
    },
    closeCheckout: () => set({ isCheckoutOpen: false }),

    // The order was saved: remember it and start a fresh cart
    completeSale: (order, customer) => {
      const state = get();
      const sale: CompletedSale = {
        order,
        items: state.items,
        totals: computeTotals(state),
        paymentType: state.paymentType,
        paymentMethod: state.paymentMethod,
        paidAmount: getFinalPaidAmount(state.paymentMethod, state.paidAmount),
        customer,
        note: state.note,
        orderDate: state.orderDate,
        completedAt: new Date().toISOString(),
      };
      set({ ...initialData(), lastSale: sale, saleCount: state.saleCount + 1 });
      return sale;
    },

    // Empty cart and default options, with today's date (the last sale is kept)
    reset: () => set(initialData()),
  };
});

// Totals for the current cart; memoised so components don't re-render on unrelated changes
export const useCartTotals = () => {
  const items = useCartStore((state) => state.items);
  const priceMode = useCartStore((state) => state.priceMode);
  const discountPercent = useCartStore((state) => state.discountPercent);
  const markupAmount = useCartStore((state) => state.markupAmount);
  return useMemo(
    () => computeTotals({ items, priceMode, discountPercent, markupAmount }),
    [items, priceMode, discountPercent, markupAmount],
  );
};

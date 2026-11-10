import type { CreateOrderRequest } from '../../../services/pos/types';
import type { CartItem, Totals } from './pricing';
import { PAYMENT_METHODS, PaymentMethod, toApiPaymentMethod } from './paymentMethods';

export type PaymentType = 'paid' | 'credit';

export type CheckoutError =
  | 'EMPTY_CART'
  | 'PAID_LESS_THAN_TOTAL'
  | 'CUSTOMER_REQUIRED'
  | 'CREDIT_PAID_EXCEEDS_TOTAL';

export interface CheckoutInput {
  items: CartItem[];
  totals: Totals;
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  creditPersonId: string;
  note: string;
  // YYYY-MM-DD, as picked on the checkout screen
  orderDate: string;
}

export const isFoc = (paymentMethod: PaymentMethod) => paymentMethod === PAYMENT_METHODS.FOC;

// FOC orders are free, so nothing is recorded as paid
export const getFinalPaidAmount = (paymentMethod: PaymentMethod, paidAmount: number) =>
  isFoc(paymentMethod) ? 0 : paidAmount;

// Paid amount to prefill when the checkout screen opens
export const getInitialPaidAmount = ({
  paymentType,
  paymentMethod,
  paidAmount,
  total,
}: {
  paymentType: PaymentType;
  paymentMethod: PaymentMethod;
  paidAmount: number;
  total: number;
}) => {
  if (isFoc(paymentMethod)) return 0;
  if (paymentType === 'credit') return paidAmount || 0;
  return Math.ceil(total);
};

// Checks in the same order as the web POS, so the first problem shown is the same
export const validateCheckout = ({
  items,
  totals,
  paymentType,
  paymentMethod,
  paidAmount,
  creditPersonId,
}: CheckoutInput): CheckoutError | null => {
  if (items.length === 0) return 'EMPTY_CART';

  if (paymentType === 'paid' && !isFoc(paymentMethod) && paidAmount < totals.total) {
    return 'PAID_LESS_THAN_TOTAL';
  }

  if (paymentType === 'credit') {
    if (!creditPersonId || creditPersonId.trim() === '') return 'CUSTOMER_REQUIRED';
    if (paidAmount > totals.total) return 'CREDIT_PAID_EXCEEDS_TOTAL';
  }

  return null;
};

export const buildCreateOrderPayload = (input: CheckoutInput): CreateOrderRequest => {
  const { items, totals, paymentType, paymentMethod, paidAmount, creditPersonId, note, orderDate } = input;
  return {
    ordersProducts: items.map((item) => ({
      inventoryId: item.product._id,
      quantity: item.qty,
    })),
    subTotal: totals.subtotal,
    discount: totals.discountAmount,
    finalAmount: totals.total,
    paidAmount: getFinalPaidAmount(paymentMethod, paidAmount),
    paymentType,
    note,
    paymentMethod: toApiPaymentMethod(paymentMethod),
    // Midnight UTC of the picked day, the same value the web POS sends
    orderDate: new Date(orderDate).toISOString(),
    ...(creditPersonId ? { creditPersonId } : {}),
  };
};

// Today on the device's own calendar. The web POS uses the UTC date, which in Myanmar (UTC+6:30)
// is still yesterday before 6:30 in the morning.
export const getTodayDateString = (now: Date = new Date()) => {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
};

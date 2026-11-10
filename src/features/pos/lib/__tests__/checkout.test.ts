import type { PosProduct } from '../../../../services/pos/types';
import {
  buildCreateOrderPayload,
  CheckoutInput,
  getFinalPaidAmount,
  getInitialPaidAmount,
  getTodayDateString,
  validateCheckout,
} from '../checkout';
import { fromApiPaymentMethod, PAYMENT_METHODS, PaymentMethod, toApiPaymentMethod } from '../paymentMethods';
import { computeTotals } from '../pricing';

const product: PosProduct = { _id: 'inv1', productName: 'Oil', sellingPrice: 1000, availableQuantity: 10 };
const items = [{ product, qty: 3 }];
const totals = computeTotals({ items, priceMode: 'normal', discountPercent: 0, markupAmount: 0 }); // 3000

const input = (overrides: Partial<CheckoutInput> = {}): CheckoutInput => ({
  items,
  totals,
  paymentType: 'paid',
  paymentMethod: PAYMENT_METHODS.CASH,
  paidAmount: 3000,
  creditPersonId: '',
  note: '',
  orderDate: '2026-10-23',
  ...overrides,
});

describe('validateCheckout', () => {
  it('needs something in the cart', () => {
    expect(validateCheckout(input({ items: [] }))).toBe('EMPTY_CART');
  });

  it('paid orders must be paid in full', () => {
    expect(validateCheckout(input({ paidAmount: 2999 }))).toBe('PAID_LESS_THAN_TOTAL');
    expect(validateCheckout(input({ paidAmount: 3000 }))).toBeNull();
    expect(validateCheckout(input({ paidAmount: 5000 }))).toBeNull();
  });

  it('FOC needs no payment', () => {
    expect(validateCheckout(input({ paymentMethod: PAYMENT_METHODS.FOC, paidAmount: 0 }))).toBeNull();
  });

  it('credit orders need a customer', () => {
    expect(validateCheckout(input({ paymentType: 'credit', paidAmount: 0 }))).toBe('CUSTOMER_REQUIRED');
    expect(validateCheckout(input({ paymentType: 'credit', paidAmount: 0, creditPersonId: '  ' }))).toBe(
      'CUSTOMER_REQUIRED',
    );
  });

  it('credit orders may be part paid but not overpaid', () => {
    const credit = { paymentType: 'credit' as const, creditPersonId: 'cp1' };
    expect(validateCheckout(input({ ...credit, paidAmount: 0 }))).toBeNull();
    expect(validateCheckout(input({ ...credit, paidAmount: 1500 }))).toBeNull();
    expect(validateCheckout(input({ ...credit, paidAmount: 3000 }))).toBeNull();
    expect(validateCheckout(input({ ...credit, paidAmount: 3001 }))).toBe('CREDIT_PAID_EXCEEDS_TOTAL');
  });

  it('reports the first problem first', () => {
    expect(validateCheckout(input({ items: [], paymentType: 'credit' }))).toBe('EMPTY_CART');
  });
});

describe('paid amounts', () => {
  it('FOC records nothing as paid', () => {
    expect(getFinalPaidAmount(PAYMENT_METHODS.FOC, 3000)).toBe(0);
    expect(getFinalPaidAmount(PAYMENT_METHODS.CASH, 3000)).toBe(3000);
  });

  it('prefills the checkout screen', () => {
    const base = { paymentType: 'paid' as const, paymentMethod: PAYMENT_METHODS.CASH, paidAmount: 0 };
    expect(getInitialPaidAmount({ ...base, total: 2699.4 })).toBe(2700);
    expect(getInitialPaidAmount({ ...base, paymentMethod: PAYMENT_METHODS.FOC, total: 3000 })).toBe(0);
    expect(getInitialPaidAmount({ ...base, paymentType: 'credit', paidAmount: 1200, total: 3000 })).toBe(1200);
    expect(getInitialPaidAmount({ ...base, paymentType: 'credit', total: 3000 })).toBe(0);
  });
});

describe('buildCreateOrderPayload', () => {
  it('builds the POST /order body', () => {
    expect(buildCreateOrderPayload(input({ note: 'urgent', paymentMethod: PAYMENT_METHODS.KBZ_PAY }))).toEqual({
      ordersProducts: [{ inventoryId: 'inv1', quantity: 3 }],
      subTotal: 3000,
      discount: 0,
      finalAmount: 3000,
      paidAmount: 3000,
      paymentType: 'paid',
      note: 'urgent',
      paymentMethod: 'kpay',
      orderDate: '2026-10-23T00:00:00.000Z',
    });
  });

  it('includes the customer only when one is chosen', () => {
    expect(buildCreateOrderPayload(input())).not.toHaveProperty('creditPersonId');
    expect(
      buildCreateOrderPayload(input({ paymentType: 'credit', creditPersonId: 'cp1', paidAmount: 0 })),
    ).toMatchObject({ paymentType: 'credit', creditPersonId: 'cp1', paidAmount: 0 });
  });

  it('sends discounts as an amount', () => {
    const discounted = computeTotals({ items, priceMode: 'discount', discountPercent: 10, markupAmount: 0 });
    expect(buildCreateOrderPayload(input({ totals: discounted, paidAmount: 2700 }))).toMatchObject({
      subTotal: 3000,
      discount: 300,
      finalAmount: 2700,
    });
  });

  it('FOC sends a paid amount of 0', () => {
    expect(
      buildCreateOrderPayload(input({ paymentMethod: PAYMENT_METHODS.FOC, paidAmount: 3000 })),
    ).toMatchObject({ paidAmount: 0, paymentMethod: 'foc' });
  });
});

describe('getTodayDateString', () => {
  it('uses the local calendar day', () => {
    expect(getTodayDateString(new Date(2026, 0, 5, 1, 30))).toBe('2026-01-05');
    expect(getTodayDateString(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('payment methods', () => {
  it('maps to the API values the backend accepts', () => {
    expect(toApiPaymentMethod(PAYMENT_METHODS.CASH)).toBe('cash');
    expect(toApiPaymentMethod(PAYMENT_METHODS.KBZ_PAY)).toBe('kpay');
    expect(toApiPaymentMethod(PAYMENT_METHODS.MMQR)).toBe('MMQR');
    expect(toApiPaymentMethod(PAYMENT_METHODS.BANK_TRANSFER)).toBe('bank_transfer');
    expect(toApiPaymentMethod(PAYMENT_METHODS.FOC)).toBe('foc');
  });

  it('round-trips every method', () => {
    for (const method of Object.values(PAYMENT_METHODS) as PaymentMethod[]) {
      expect(fromApiPaymentMethod(toApiPaymentMethod(method))).toBe(method);
    }
  });

  it('falls back to cash for unknown values', () => {
    expect(fromApiPaymentMethod('bitcoin')).toBe(PAYMENT_METHODS.CASH);
    expect(fromApiPaymentMethod(undefined)).toBe(PAYMENT_METHODS.CASH);
  });
});

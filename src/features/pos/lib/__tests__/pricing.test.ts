import type { PosProduct } from '../../../../services/pos/types';
import {
  computeTotals,
  discountPercentFromAmount,
  getChangeAmount,
  getLineTotal,
  getSafeQty,
  getSortedWholesaleTiers,
  getUnitPrice,
  markupPercentOf,
} from '../pricing';

const product = (overrides: Partial<PosProduct> = {}): PosProduct => ({
  _id: 'p1',
  productName: 'Engine Oil',
  sellingPrice: 1000,
  availableQuantity: 100,
  ...overrides,
});

// Tiers deliberately out of order
const wholesale = product({
  wholesalePrices: [
    { quantity: 10, price: 900 },
    { quantity: 5, price: 950 },
  ],
});

describe('getUnitPrice', () => {
  it('uses the selling price below the first tier', () => {
    expect(getUnitPrice(wholesale, 1)).toBe(1000);
    expect(getUnitPrice(wholesale, 4)).toBe(1000);
  });

  it('uses the highest tier the quantity reaches', () => {
    expect(getUnitPrice(wholesale, 5)).toBe(950);
    expect(getUnitPrice(wholesale, 9)).toBe(950);
    expect(getUnitPrice(wholesale, 10)).toBe(900);
    expect(getUnitPrice(wholesale, 100)).toBe(900);
  });

  it('defaults to quantity 1', () => {
    expect(getUnitPrice(wholesale)).toBe(1000);
  });

  it('handles products without tiers or price', () => {
    expect(getUnitPrice(product(), 50)).toBe(1000);
    expect(getUnitPrice(product({ sellingPrice: undefined as unknown as number }), 1)).toBe(0);
  });
});

describe('getSortedWholesaleTiers', () => {
  it('sorts by quantity without changing the product', () => {
    expect(getSortedWholesaleTiers(wholesale).map((t) => t.quantity)).toEqual([5, 10]);
    expect(wholesale.wholesalePrices?.map((t) => t.quantity)).toEqual([10, 5]);
  });
});

describe('getSafeQty', () => {
  it('floors positive numbers and zeroes everything else', () => {
    expect(getSafeQty(2.7)).toBe(2);
    expect(getSafeQty(3)).toBe(3);
    expect(getSafeQty(0)).toBe(0);
    expect(getSafeQty(-1)).toBe(0);
    expect(getSafeQty(NaN)).toBe(0);
    expect(getSafeQty(Infinity)).toBe(0);
  });
});

describe('getLineTotal', () => {
  it('prices the whole line at the tier for its quantity', () => {
    expect(getLineTotal({ product: wholesale, qty: 6 })).toBe(5700);
  });

  it('is 0 for an invalid quantity', () => {
    expect(getLineTotal({ product: wholesale, qty: 0 })).toBe(0);
  });
});

describe('computeTotals', () => {
  // 2 x 1000 + 3 x 333 = 2999
  const items = [
    { product: product(), qty: 2 },
    { product: product({ _id: 'p2', sellingPrice: 333 }), qty: 3 },
  ];

  it('normal price: total is the subtotal', () => {
    expect(computeTotals({ items, priceMode: 'normal', discountPercent: 0, markupAmount: 0 })).toEqual({
      itemCount: 5,
      subtotal: 2999,
      discountAmount: 0,
      markupAmount: 0,
      total: 2999,
    });
  });

  it('discount: rounds the total and reports the difference', () => {
    const totals = computeTotals({ items, priceMode: 'discount', discountPercent: 10, markupAmount: 0 });
    expect(totals.total).toBe(2699); // round(2699.1)
    expect(totals.discountAmount).toBe(300);
  });

  it('a 100% discount makes it free', () => {
    const totals = computeTotals({ items, priceMode: 'discount', discountPercent: 100, markupAmount: 0 });
    expect(totals.total).toBe(0);
    expect(totals.discountAmount).toBe(2999);
  });

  it('markup: adds the fixed amount and has no discount', () => {
    const totals = computeTotals({ items, priceMode: 'markup', discountPercent: 10, markupAmount: 500 });
    expect(totals.total).toBe(3499);
    expect(totals.discountAmount).toBe(0);
    expect(totals.markupAmount).toBe(500);
  });

  it('ignores values that belong to another price mode', () => {
    expect(computeTotals({ items, priceMode: 'normal', discountPercent: 10, markupAmount: 500 }).total).toBe(2999);
    expect(computeTotals({ items, priceMode: 'discount', discountPercent: 0, markupAmount: 500 }).total).toBe(2999);
  });

  it('an empty cart totals 0', () => {
    expect(computeTotals({ items: [], priceMode: 'normal', discountPercent: 0, markupAmount: 0 })).toEqual({
      itemCount: 0,
      subtotal: 0,
      discountAmount: 0,
      markupAmount: 0,
      total: 0,
    });
  });
});

describe('discountPercentFromAmount', () => {
  it('converts an amount to a percentage of the subtotal', () => {
    expect(discountPercentFromAmount(250, 1000)).toBe(25);
    expect(discountPercentFromAmount(1000, 1000)).toBe(100);
  });

  it('rejects amounts that cannot be applied', () => {
    expect(discountPercentFromAmount(0, 1000)).toBeNull();
    expect(discountPercentFromAmount(-5, 1000)).toBeNull();
    expect(discountPercentFromAmount(1001, 1000)).toBeNull();
    expect(discountPercentFromAmount(100, 0)).toBeNull();
    expect(discountPercentFromAmount(NaN, 1000)).toBeNull();
  });

  it('an amount turned into a percentage takes exactly that amount off', () => {
    const items = [
      { product: product(), qty: 2 },
      { product: product({ _id: 'p2', sellingPrice: 333 }), qty: 3 },
    ];
    const percent = discountPercentFromAmount(300, 2999) as number;
    const totals = computeTotals({ items, priceMode: 'discount', discountPercent: percent, markupAmount: 0 });
    expect(totals.discountAmount).toBe(300);
    expect(totals.total).toBe(2699);
  });
});

describe('markupPercentOf', () => {
  it('is the share of the subtotal', () => {
    expect(markupPercentOf(500, 2000)).toBe(25);
    expect(markupPercentOf(500, 0)).toBe(0);
  });
});

describe('getChangeAmount', () => {
  it('never goes negative', () => {
    expect(getChangeAmount(5000, 4200)).toBe(800);
    expect(getChangeAmount(4000, 4200)).toBe(0);
  });
});

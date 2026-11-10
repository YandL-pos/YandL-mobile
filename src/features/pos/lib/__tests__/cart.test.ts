import type { PosProduct } from '../../../../services/pos/types';
import {
  addItem,
  applyWholesaleTier,
  changeQty,
  filterProducts,
  getAvailableStock,
  getCartQty,
  HIDDEN_PRODUCT_IDS,
  removeItem,
  setItemQty,
} from '../cart';
import type { CartItem } from '../pricing';

const product = (id: string, overrides: Partial<PosProduct> = {}): PosProduct => ({
  _id: id,
  productName: `Product ${id}`,
  sellingPrice: 100,
  availableQuantity: 3,
  ...overrides,
});

const A = product('a');

describe('getAvailableStock', () => {
  it('prefers availableQuantity, then quantity, then 0', () => {
    expect(getAvailableStock(product('x', { availableQuantity: 4, quantity: 9 }))).toBe(4);
    expect(getAvailableStock(product('x', { availableQuantity: undefined, quantity: 2 }))).toBe(2);
    expect(getAvailableStock(product('x', { availableQuantity: undefined }))).toBe(0);
  });

  it('treats an availableQuantity of 0 as out of stock even when quantity is set', () => {
    expect(getAvailableStock(product('x', { availableQuantity: 0, quantity: 5 }))).toBe(0);
  });

  it('adds back what the edited order already holds', () => {
    expect(getAvailableStock(product('x', { availableQuantity: 1 }), { x: 2 })).toBe(3);
  });
});

describe('addItem', () => {
  it('adds a new line with quantity 1', () => {
    expect(addItem([], A)).toEqual({ items: [{ product: A, qty: 1 }] });
  });

  it('increments an existing line up to the stock', () => {
    let items: CartItem[] = [];
    for (let i = 0; i < 3; i++) items = addItem(items, A).items;
    expect(getCartQty(items, 'a')).toBe(3);

    const result = addItem(items, A);
    expect(result.error).toBe('EXCEEDS_STOCK');
    expect(result.items).toBe(items);
  });

  it('refuses out-of-stock products', () => {
    const B = product('b', { availableQuantity: 0 });
    expect(addItem([], B)).toEqual({ items: [], error: 'OUT_OF_STOCK' });
  });

  it('allows stock the edited order already holds', () => {
    const B = product('b', { availableQuantity: 0 });
    const original = { b: 2 };
    let result = addItem([], B, original);
    result = addItem(result.items, B, original);
    expect(getCartQty(result.items, 'b')).toBe(2);
    expect(addItem(result.items, B, original).error).toBe('EXCEEDS_STOCK');
  });
});

describe('changeQty', () => {
  const items: CartItem[] = [{ product: A, qty: 2 }];

  it('moves the quantity by the delta', () => {
    expect(getCartQty(changeQty(items, 'a', 1).items, 'a')).toBe(3);
    expect(getCartQty(changeQty(items, 'a', -1).items, 'a')).toBe(1);
  });

  it('stops at the stock with an error', () => {
    const result = changeQty([{ product: A, qty: 3 }], 'a', 1);
    expect(result.error).toBe('EXCEEDS_STOCK');
    expect(getCartQty(result.items, 'a')).toBe(3);
  });

  it('never goes below 1, silently', () => {
    const result = changeQty([{ product: A, qty: 1 }], 'a', -1);
    expect(result.error).toBeUndefined();
    expect(getCartQty(result.items, 'a')).toBe(1);
  });

  it('ignores products not in the cart', () => {
    expect(changeQty(items, 'zzz', 1).items).toBe(items);
  });
});

describe('setItemQty', () => {
  const items: CartItem[] = [{ product: A, qty: 2 }];

  it('sets a typed quantity', () => {
    expect(getCartQty(setItemQty(items, 'a', 3).items, 'a')).toBe(3);
  });

  it('floors fractions and turns 0, negatives and NaN into 1', () => {
    expect(getCartQty(setItemQty(items, 'a', 2.9).items, 'a')).toBe(2);
    expect(getCartQty(setItemQty(items, 'a', 0).items, 'a')).toBe(1);
    expect(getCartQty(setItemQty(items, 'a', -4).items, 'a')).toBe(1);
    expect(getCartQty(setItemQty(items, 'a', NaN).items, 'a')).toBe(1);
  });

  it('caps at the stock with an error', () => {
    const result = setItemQty(items, 'a', 10);
    expect(result.error).toBe('EXCEEDS_STOCK');
    expect(getCartQty(result.items, 'a')).toBe(3);
  });
});

describe('applyWholesaleTier', () => {
  const T = product('t', {
    availableQuantity: 8,
    wholesalePrices: [{ quantity: 5, price: 90 }],
  });

  it('adds a new line at the tier quantity', () => {
    expect(applyWholesaleTier([], T, 5)).toEqual({ items: [{ product: T, qty: 5 }], error: undefined });
  });

  it('replaces the quantity of an existing line', () => {
    const result = applyWholesaleTier([{ product: T, qty: 2 }], T, 5);
    expect(result.items).toHaveLength(1);
    expect(getCartQty(result.items, 't')).toBe(5);
  });

  it('caps at the stock and reports it', () => {
    const result = applyWholesaleTier([], T, 10);
    expect(result.error).toBe('EXCEEDS_STOCK');
    expect(getCartQty(result.items, 't')).toBe(8);
  });

  it('rejects invalid tiers and out-of-stock products', () => {
    expect(applyWholesaleTier([], T, 0).error).toBe('INVALID_QUANTITY');
    expect(applyWholesaleTier([], T, NaN).error).toBe('INVALID_QUANTITY');
    expect(applyWholesaleTier([], product('o', { availableQuantity: 0 }), 5).error).toBe('OUT_OF_STOCK');
  });
});

describe('removeItem', () => {
  it('drops the line', () => {
    const B = product('b');
    expect(removeItem([{ product: A, qty: 1 }, { product: B, qty: 2 }], 'a')).toEqual([{ product: B, qty: 2 }]);
  });
});

describe('filterProducts', () => {
  const products = [
    product('zero', { availableQuantity: 0 }),
    product('negative', { availableQuantity: -1 }),
    product('five', { availableQuantity: 5 }),
    product('six', { availableQuantity: 6 }),
    product(HIDDEN_PRODUCT_IDS[0], { availableQuantity: 50 }),
  ];
  const ids = (list: PosProduct[]) => list.map((p) => p._id);

  it('always hides the hidden products', () => {
    expect(ids(filterProducts(products, 'All'))).toEqual(['zero', 'negative', 'five', 'six']);
  });

  it('filters by stock level', () => {
    expect(ids(filterProducts(products, 'InStock'))).toEqual(['five', 'six']);
    expect(ids(filterProducts(products, 'LowStock'))).toEqual(['five']);
    expect(ids(filterProducts(products, 'OutOfStock'))).toEqual(['zero', 'negative']);
  });
});

import type { PosProduct } from '../../../../services/pos/types';
import { HIDDEN_PRODUCT_IDS } from '../../../pos/lib/cart';
import {
  classifyStock,
  countAlerts,
  countUnread,
  mergeAlerts,
  sortAlerts,
  toAlertItem,
  toAlerts,
} from '../stockAlerts';

const rules = { lowStockThreshold: 5, outOfStockAlert: true };

const product = (id: string, qty: number, overrides: Partial<PosProduct> = {}): PosProduct => ({
  _id: id,
  productName: `Product ${id}`,
  productCode: `CODE-${id}`,
  category: 'Oil',
  sellingPrice: 1000,
  buyingPrice: 800,
  availableQuantity: qty,
  ...overrides,
});

describe('classifyStock', () => {
  it('marks zero or less as out of stock', () => {
    expect(classifyStock(0, rules)).toBe('out_of_stock');
    expect(classifyStock(-2, rules)).toBe('out_of_stock');
  });

  it('marks up to the threshold as low', () => {
    expect(classifyStock(1, rules)).toBe('low_stock');
    expect(classifyStock(5, rules)).toBe('low_stock');
    expect(classifyStock(6, rules)).toBeNull();
  });

  it('follows the chosen threshold', () => {
    expect(classifyStock(8, { ...rules, lowStockThreshold: 10 })).toBe('low_stock');
    expect(classifyStock(4, { ...rules, lowStockThreshold: 3 })).toBeNull();
  });

  it('skips out-of-stock products when that alert is off', () => {
    expect(classifyStock(0, { ...rules, outOfStockAlert: false })).toBeNull();
    expect(classifyStock(2, { ...rules, outOfStockAlert: false })).toBe('low_stock');
  });
});

describe('toAlertItem', () => {
  it('builds the alert with prices and category', () => {
    expect(toAlertItem(product('a', 3), rules)).toEqual({
      id: 'low_a',
      productId: 'a',
      productName: 'Product a',
      productCode: 'CODE-a',
      categoryName: 'Oil',
      stockQty: 3,
      buyingPrice: 800,
      sellingPrice: 1000,
      type: 'low_stock',
      threshold: 5,
    });
    expect(toAlertItem(product('b', 0), rules)?.id).toBe('out_b');
  });

  it('ignores healthy and hidden products', () => {
    expect(toAlertItem(product('c', 20), rules)).toBeNull();
    expect(toAlertItem(product(HIDDEN_PRODUCT_IDS[0], 0), rules)).toBeNull();
  });

  it('falls back when names and categories are missing', () => {
    const alert = toAlertItem(product('d', 1, { productName: '', category: undefined, productCode: undefined }), rules);
    expect(alert).toMatchObject({ productName: 'ပစ္စည်းအမည်မရှိ', categoryName: 'အထွေထွေ', productCode: '' });
  });
});

describe('sorting and counting', () => {
  const alerts = toAlerts([product('low4', 4), product('out', 0), product('low1', 1), product('ok', 9)], rules);

  it('puts out of stock first, then lowest stock', () => {
    expect(alerts.map((a) => a.productId)).toEqual(['out', 'low1', 'low4']);
    expect(sortAlerts(alerts.slice().reverse()).map((a) => a.productId)).toEqual(['out', 'low1', 'low4']);
  });

  it('counts each kind', () => {
    expect(countAlerts(alerts)).toEqual({ outOfStock: 1, lowStock: 2, total: 3 });
  });

  it('counts unread against the read ids', () => {
    expect(countUnread(alerts, ['out_out', 'low_low1'])).toBe(1);
    expect(countUnread(alerts, [])).toBe(3);
  });
});

describe('mergeAlerts', () => {
  const current = toAlerts([product('a', 4), product('b', 2)], rules);

  it('updates the sold products and keeps the others', () => {
    const merged = mergeAlerts(current, [product('a', 0)], rules);
    expect(merged.map((a) => a.id)).toEqual(['out_a', 'low_b']);
  });

  it('drops a product that is no longer low and adds a new one', () => {
    const merged = mergeAlerts(current, [product('b', 30), product('c', 1)], rules);
    expect(merged.map((a) => a.id)).toEqual(['low_c', 'low_a']);
  });
});

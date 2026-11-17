import type { PosProduct } from '../../../services/pos/types';
import { getShelfStock, HIDDEN_PRODUCT_IDS } from '../../pos/lib/cart';

// Low and out-of-stock alerts, following offline-pos's rules

export type StockAlertType = 'out_of_stock' | 'low_stock';

export interface StockAlertItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  categoryName: string;
  stockQty: number;
  buyingPrice: number;
  sellingPrice: number;
  type: StockAlertType;
  threshold: number;
}

export interface AlertRules {
  lowStockThreshold: number;
  outOfStockAlert: boolean;
}

// 0 or less is "out of stock" (only when that alert is on); up to the threshold is "low"
export const classifyStock = (qty: number, rules: AlertRules): StockAlertType | null => {
  if (qty <= 0) return rules.outOfStockAlert ? 'out_of_stock' : null;
  if (qty <= rules.lowStockThreshold) return 'low_stock';
  return null;
};

export const toAlertItem = (product: PosProduct, rules: AlertRules): StockAlertItem | null => {
  if (HIDDEN_PRODUCT_IDS.includes(product._id)) return null;
  const stockQty = getShelfStock(product);
  const type = classifyStock(stockQty, rules);
  if (!type) return null;
  return {
    id: `${type === 'out_of_stock' ? 'out' : 'low'}_${product._id}`,
    productId: product._id,
    productName: product.productName || 'ပစ္စည်းအမည်မရှိ',
    productCode: product.productCode || product.SKU || '',
    categoryName: product.category || 'အထွေထွေ',
    stockQty,
    buyingPrice: product.buyingPrice || 0,
    sellingPrice: product.sellingPrice || 0,
    type,
    threshold: rules.lowStockThreshold,
  };
};

// Out of stock first, then the lowest stock
export const sortAlerts = (alerts: StockAlertItem[]) =>
  alerts.slice().sort((a, b) => {
    if (a.type !== b.type) return a.type === 'out_of_stock' ? -1 : 1;
    return a.stockQty - b.stockQty;
  });

export const toAlerts = (products: PosProduct[], rules: AlertRules) =>
  sortAlerts(products.map((p) => toAlertItem(p, rules)).filter((a): a is StockAlertItem => !!a));

// Fresh stock for some products (e.g. the ones just sold) replaces their old alerts
export const mergeAlerts = (current: StockAlertItem[], products: PosProduct[], rules: AlertRules) => {
  const freshIds = new Set(products.map((p) => p._id));
  return sortAlerts([...current.filter((a) => !freshIds.has(a.productId)), ...toAlerts(products, rules)]);
};

export const countAlerts = (alerts: StockAlertItem[]) => {
  const outOfStock = alerts.filter((a) => a.type === 'out_of_stock').length;
  return { outOfStock, lowStock: alerts.length - outOfStock, total: alerts.length };
};

export const countUnread = (alerts: StockAlertItem[], readIds: string[]) => {
  const read = new Set(readIds);
  return alerts.filter((a) => !read.has(a.id)).length;
};

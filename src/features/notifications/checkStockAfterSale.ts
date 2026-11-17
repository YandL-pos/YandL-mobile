import { notificationService } from '../../services/notificationService';
import { fetchProductsByIds } from '../../services/pos/posApi';
import type { PosProduct } from '../../services/pos/types';
import { useNotificationSettingsStore } from '../../store/notificationSettingsStore';
import { useStockAlertStore } from '../../store/stockAlertStore';
import { getSafeQty, getShelfStock } from '../pos/lib';
import type { CartItem } from '../pos/lib';
import { toAlerts } from './lib/stockAlerts';

// More products than this going low in one sale get one summary notification instead of one each
const MAX_SEPARATE_NOTIFICATIONS = 3;

const notifyLowStock = async (products: PosProduct[]) => {
  const { lowStockThreshold, outOfStockAlert } = useNotificationSettingsStore.getState();
  const alerts = toAlerts(products, { lowStockThreshold, outOfStockAlert });
  if (alerts.length === 0) return;

  if (alerts.length > MAX_SEPARATE_NOTIFICATIONS) {
    const outOfStock = alerts.filter((a) => a.type === 'out_of_stock').length;
    await notificationService.sendSummaryNotification(outOfStock, alerts.length - outOfStock);
    return;
  }
  for (const alert of alerts) {
    if (alert.type === 'out_of_stock') await notificationService.sendOutOfStockNotification(alert.productName);
    else await notificationService.sendLowStockNotification(alert.productName, alert.stockQty);
  }
};

const isEnabled = async () => {
  const settings = useNotificationSettingsStore.getState();
  if (!settings.isLoaded) await settings.loadSettings();
  return useNotificationSettingsStore.getState().enabled;
};

// After a native POS sale is saved: read the sold products' stock in the storefront they were sold
// from again and notify when any are low. A product that can't be read uses the cart's stock less
// what was sold.
export const checkStockAfterSale = async (storefrontId: string | undefined, items: CartItem[]) => {
  try {
    if (!storefrontId || items.length === 0 || !(await isEnabled())) return;

    const byId = new Map(items.map((item) => [item.product._id, item]));
    const fetched = await fetchProductsByIds(storefrontId, [...byId.keys()]);
    const products = [...byId.values()].map(
      (item) =>
        fetched.get(item.product._id) ?? {
          ...item.product,
          availableQuantity: getShelfStock(item.product) - getSafeQty(item.qty),
        },
    );

    // Only the page's list for this storefront takes the fresh stock
    useStockAlertStore.getState().applyProducts(storefrontId, products);
    await notifyLowStock(products);
  } catch (err) {
    console.warn('Stock check after sale failed:', err);
  }
};

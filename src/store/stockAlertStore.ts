import { useMemo } from 'react';
import { create } from 'zustand';
import RNFS from 'react-native-fs';

import { countUnread, mergeAlerts, StockAlertItem, toAlerts } from '../features/notifications/lib/stockAlerts';
import { fetchProducts, fetchStorefronts } from '../services/pos/posApi';
import type { PosProduct, StorefrontProfile } from '../services/pos/types';
import { useNotificationSettingsStore } from './notificationSettingsStore';
import { useShopStore } from './shopStore';

const READ_IDS_PATH = `${RNFS.DocumentDirectoryPath}/read_notifications.json`;
const PAGE_SIZE = 100;
// Safety cap so a huge catalogue can't keep the page loading forever
const MAX_PAGES = 30;

interface StockAlertState {
  alerts: StockAlertItem[];
  readIds: string[];
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  // Alerts are for one storefront: the one the POS sells from
  storefront: StorefrontProfile | null;
  // Full list, only when the notification page opens or is refreshed (never on a timer)
  loadAlerts: () => Promise<void>;
  // Fresh stock for products just sold from a storefront; ignored for another storefront's list
  applyProducts: (storefrontId: string, products: PosProduct[]) => void;
  markAsRead: (productId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const rules = () => {
  const { lowStockThreshold, outOfStockAlert } = useNotificationSettingsStore.getState();
  return { lowStockThreshold, outOfStockAlert };
};

const saveReadIds = async (ids: string[]) => {
  try {
    await RNFS.writeFile(READ_IDS_PATH, JSON.stringify(ids), 'utf8');
  } catch (err) {
    console.warn('Failed to save read notifications:', err);
  }
};

const loadReadIds = async (): Promise<string[]> => {
  try {
    if (!(await RNFS.exists(READ_IDS_PATH))) return [];
    const saved = JSON.parse(await RNFS.readFile(READ_IDS_PATH, 'utf8'));
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

// Same rule as the POS screen (useStorefront): the one picked last, else the first active one.
// The POS screen may not have opened yet (the page can open from a notification or the web header).
const resolveStorefront = async (): Promise<{ storefront: StorefrontProfile | null } | { error: string }> => {
  const { posStorefront, preferredStorefrontId, lockedStorefrontId } = useShopStore.getState();
  const targetId = lockedStorefrontId ?? preferredStorefrontId;
  if (posStorefront && (!targetId || posStorefront._id === targetId)) {
    return { storefront: posStorefront };
  }
  const res = await fetchStorefronts();
  if (!res.success) return { error: res.message };
  const active = res.data.filter((sf) => sf.status === 'active');
  return { storefront: active.find((sf) => sf._id === targetId) ?? (lockedStorefrontId ? null : active[0] ?? null) };
};

// The backend has no stock filter, so this walks every page of the storefront's (active) products
const fetchAllProducts = async (storefrontId: string): Promise<{ products: PosProduct[] } | { error: string }> => {
  const products: PosProduct[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await fetchProducts({ storefrontId, page, limit: PAGE_SIZE });
    if (!res.success) return { error: res.message };
    products.push(...(res.data || []));
    if (page >= (res.pagination?.totalPages ?? 1) || !res.data?.length) break;
  }
  return { products };
};

export const useStockAlertStore = create<StockAlertState>((set, get) => ({
  alerts: [],
  readIds: [],
  isLoading: false,
  isLoaded: false,
  error: null,
  storefront: null,

  loadAlerts: async () => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    const settings = useNotificationSettingsStore.getState();
    if (!settings.isLoaded) await settings.loadSettings();
    const savedReadIds = get().isLoaded ? get().readIds : await loadReadIds();

    if (!useNotificationSettingsStore.getState().enabled) {
      set({ alerts: [], readIds: savedReadIds, isLoading: false, isLoaded: true });
      return;
    }

    const resolved = await resolveStorefront();
    if ('error' in resolved) {
      set({ isLoading: false, isLoaded: true, error: resolved.error, readIds: savedReadIds });
      return;
    }
    const { storefront } = resolved;
    if (!storefront) {
      set({
        alerts: [],
        storefront: null,
        readIds: savedReadIds,
        isLoading: false,
        isLoaded: true,
        error: 'Storefront မရှိသေးပါ။ Web app မှာ storefront အရင်ထည့်ပါ။',
      });
      return;
    }

    set({ alerts: [], storefront });
    const result = await fetchAllProducts(storefront._id);
    const lockedId = useShopStore.getState().lockedStorefrontId;
    if (lockedId && lockedId !== storefront._id) {
      set({ alerts: [], storefront: null, isLoading: false });
      return get().loadAlerts();
    }
    if ('error' in result) {
      set({ isLoading: false, isLoaded: true, error: result.error, readIds: savedReadIds, storefront });
      return;
    }
    const alerts = toAlerts(result.products, rules());
    // Forget "read" marks for products that are no longer low
    const active = new Set(alerts.map((a) => a.id));
    const readIds = savedReadIds.filter((id) => active.has(id));
    set({ alerts, readIds, storefront, isLoading: false, isLoaded: true });
    saveReadIds(readIds);
  },

  applyProducts: (storefrontId, products) => {
    if (!useNotificationSettingsStore.getState().enabled || products.length === 0) return;
    // Before the page has loaded, the list is empty and belongs to no storefront yet
    const lockedId = useShopStore.getState().lockedStorefrontId;
    if (lockedId && lockedId !== storefrontId) return;
    const current = get().storefront;
    if (current && current._id !== storefrontId) return;
    set({ alerts: mergeAlerts(get().alerts, products, rules()) });
  },

  markAsRead: async (productId) => {
    const ids = get()
      .alerts.filter((a) => a.productId === productId)
      .map((a) => a.id);
    const readIds = Array.from(new Set([...get().readIds, ...ids]));
    set({ readIds });
    await saveReadIds(readIds);
  },

  markAllAsRead: async () => {
    const readIds = get().alerts.map((a) => a.id);
    set({ readIds });
    await saveReadIds(readIds);
  },
}));

export const useUnreadAlertCount = () => {
  const alerts = useStockAlertStore((state) => state.alerts);
  const readIds = useStockAlertStore((state) => state.readIds);
  return useMemo(() => countUnread(alerts, readIds), [alerts, readIds]);
};

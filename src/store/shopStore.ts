import { create } from 'zustand';

import { fetchShopSettings } from '../services/pos/posApi';
import type { ShopSettings } from '../services/pos/types';

export interface ShopProfile {
  name: string;
  address?: string;
  phone?: string;
  footerMessage?: string;
}

interface ShopState {
  // Fallbacks the receipt template uses when a receipt has no branding of its own
  shop: ShopProfile;
  setShop: (shop: Partial<ShopProfile>) => void;

  // From the backend's /shop-settings, for receipt branding
  settings: ShopSettings | null;
  // Branding profile chosen in the web app's print settings (its voucherReceiptLogoSlot)
  receiptSlot: number;
  setReceiptSlot: (slot: number) => void;
  loadSettings: () => Promise<void>;
}

export const useShopStore = create<ShopState>((set) => ({
  shop: {
    name: 'AutoShop Commercial',
    address: 'Yangon, Myanmar',
    phone: '',
    footerMessage: 'ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်။',
  },
  setShop: (shop) =>
    set((state) => ({
      shop: { ...state.shop, ...shop },
    })),

  settings: null,
  receiptSlot: 1,
  setReceiptSlot: (receiptSlot) => set({ receiptSlot }),
  loadSettings: async () => {
    const res = await fetchShopSettings();
    if (res.success && res.data) set({ settings: res.data });
  },
}));

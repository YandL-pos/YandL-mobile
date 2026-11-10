import { printerService } from '../../services/printerService';
import { useAuthStore } from '../../store/authStore';
import type { CompletedSale } from '../../store/cartStore';
import { useShopStore } from '../../store/shopStore';
import { resolveBranding, toReceiptData } from './lib';

// Print a finished sale on the connected Bluetooth printer; throws when it can't
export const printSale = async (sale: CompletedSale) => {
  const shop = useShopStore.getState();
  if (!shop.settings) await shop.loadSettings();

  const { settings, receiptSlot } = useShopStore.getState();
  const receipt = toReceiptData(sale, {
    branding: resolveBranding(settings, receiptSlot),
    cashierName: useAuthStore.getState().userName ?? undefined,
  });
  await printerService.printReceipt(receipt);
};

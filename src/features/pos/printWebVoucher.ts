import { printerService } from '../../services/printerService';
import { useAuthStore } from '../../store/authStore';
import { useShopStore } from '../../store/shopStore';
import { fromWebVoucher, PaymentType, resolveBranding, WebVoucher } from './lib';

// Print a voucher the web app sent (order details' Print) on the connected Bluetooth printer; throws when it can't
export const printWebVoucher = async (
  voucher: WebVoucher,
  order: { paymentType?: PaymentType; paymentMethod?: string } = {},
) => {
  const shop = useShopStore.getState();
  if (!shop.settings) await shop.loadSettings();

  const { settings, receiptSlot } = useShopStore.getState();
  const receipt = fromWebVoucher(voucher, {
    ...order,
    branding: resolveBranding(settings, receiptSlot),
    cashierName: useAuthStore.getState().userName ?? undefined,
  });
  await printerService.printReceipt(receipt);
};

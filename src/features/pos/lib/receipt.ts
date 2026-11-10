import type { ReceiptData } from '../../../services/receiptCaptureService';
import type { ShopSettings } from '../../../services/pos/types';
import type { CompletedSale } from '../../../store/cartStore';
import { isFoc } from './checkout';
import { PAYMENT_METHODS, SELECTABLE_PAYMENT_METHODS } from './paymentMethods';
import { getChangeAmount, getSafeQty, getUnitPrice } from './pricing';

export interface ReceiptBranding {
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
}

// Same rules as the web's getVoucherReceiptBranding: the chosen profile's details,
// falling back to the shop's own. Slot 0 means "no logo" and still uses profile 1's text.
export const resolveBranding = (settings: ShopSettings | null, slot = 1): ReceiptBranding => {
  if (!settings) return {};
  const effectiveSlot = slot === 0 ? 1 : slot;
  const profile = settings.brandingProfiles?.find((p) => p.slot === effectiveSlot);
  return {
    shopName: profile?.name?.trim() || settings.shopName || undefined,
    shopPhone: profile?.phoneNumber?.trim() || settings.phoneNumber || undefined,
    shopAddress: profile?.address?.trim() || settings.address || undefined,
  };
};

const pad = (value: number) => String(value).padStart(2, '0');

// DD/MM/YYYY HH:mm on the device clock
export const formatReceiptDate = (iso: string) => {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const getPaymentLabel = (sale: Pick<CompletedSale, 'paymentType' | 'paymentMethod'>) => {
  if (isFoc(sale.paymentMethod)) return 'အခမဲ့ (FOC)';
  if (sale.paymentType === 'credit') return 'အကြွေး';
  const method = sale.paymentMethod ?? PAYMENT_METHODS.CASH;
  return SELECTABLE_PAYMENT_METHODS.find((m) => m.id === method)?.label ?? method;
};

export const toReceiptData = (
  sale: CompletedSale,
  { branding = {}, cashierName }: { branding?: ReceiptBranding; cashierName?: string } = {},
): ReceiptData => {
  const { order, items, totals, paymentType, paidAmount, customer, completedAt } = sale;

  return {
    invoiceNo: order.orderNumber || order._id,
    date: formatReceiptDate(completedAt),
    customerName: customer?.name || undefined,
    paymentType: getPaymentLabel(sale),
    items: items.map((item) => {
      const quantity = getSafeQty(item.qty);
      const price = getUnitPrice(item.product, quantity || 1);
      return { name: item.product.productName, quantity, price, subTotal: price * quantity };
    }),
    subtotal: totals.subtotal,
    discount: totals.discountAmount,
    markup: totals.markupAmount,
    netTotal: totals.total,
    paidAmount,
    changeAmount: paymentType === 'paid' ? getChangeAmount(paidAmount, totals.total) : 0,
    dueAmount: paymentType === 'credit' ? Math.max(0, totals.total - paidAmount) : 0,
    cashierName: cashierName || undefined,
    ...branding,
  };
};

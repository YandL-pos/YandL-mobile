import type { ReceiptData } from '../../../services/receiptCaptureService';
import type { ShopSettings } from '../../../services/pos/types';
import type { CompletedSale } from '../../../store/cartStore';
import { isFoc, PaymentType } from './checkout';
import { fromApiPaymentMethod, PAYMENT_METHODS, SELECTABLE_PAYMENT_METHODS } from './paymentMethods';
import { getChangeAmount, getSafeQty, getUnitPrice } from './pricing';

export interface ReceiptBranding {
  shopName?: string;
  shopPhone?: string;
  shopAddress?: string;
  logoUrl?: string;
}

// Same rules as the web's getVoucherReceiptLogo: slot 0 prints no logo; a slot without one falls back to
// the old single logo (slot 1), then to any logo the shop has
export const resolveLogo = (settings: ShopSettings, slot: number): string | undefined => {
  if (slot === 0) return undefined;
  const logos = settings.logos || [];
  const match = logos.find((logo) => logo.slot === slot && logo.url);
  if (match) return match.url;
  if (slot === 1 && settings.logo) return settings.logo;
  return logos[0]?.url || settings.logo || undefined;
};

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
    logoUrl: resolveLogo(settings, slot),
  };
};

const pad = (value: number) => String(value).padStart(2, '0');

// DD/MM/YYYY HH:mm on the device clock
export const formatReceiptDate = (iso: string) => {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// The last part of the order number (INV/2026/0042 -> 42), printed large at the bottom like the web receipt
export const getSequenceNumber = (orderNumber: string | undefined) => {
  const value = parseInt(orderNumber?.split('/').pop() || '', 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
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
  const { order, items, totals, paymentType, paidAmount, customer, note, completedAt } = sale;

  return {
    invoiceNo: order.orderNumber || order._id,
    date: formatReceiptDate(completedAt),
    customerName: customer?.name || undefined,
    customerPhone: customer?.phone || undefined,
    customerAddress: customer?.address || undefined,
    paymentType: getPaymentLabel(sale),
    items: items.map((item) => {
      const quantity = getSafeQty(item.qty);
      const price = getUnitPrice(item.product, quantity || 1);
      return {
        name: item.product.productName,
        code: item.product.productCode || undefined,
        quantity,
        price,
        subTotal: price * quantity,
      };
    }),
    subtotal: totals.subtotal,
    discount: totals.discountAmount,
    discountPercent: totals.subtotal > 0 ? (totals.discountAmount / totals.subtotal) * 100 : 0,
    markup: totals.markupAmount,
    netTotal: totals.total,
    paidAmount,
    changeAmount: paymentType === 'paid' ? getChangeAmount(paidAmount, totals.total) : 0,
    dueAmount: paymentType === 'credit' ? Math.max(0, totals.total - paidAmount) : 0,
    cashierName: cashierName || undefined,
    note: note.trim() || undefined,
    sequenceNumber: getSequenceNumber(order.orderNumber),
    ...branding,
  };
};

// The voucher the web app builds for printing (VoucherReceiptData in its VoucherContent.tsx)
export interface WebVoucher {
  invoiceNumber: string;
  date: string;
  items: { name: string; code?: string; qty: number; price: number }[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  total: number;
  paidAmount?: number;
  change?: number;
  note?: string;
  serviceCharge?: number;
  tax?: number;
  receiptSequenceNumber?: number;
  cashierName?: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
}

// A voucher printed from the web app (order details' Print), laid out like a native POS receipt.
// The order's own paymentType and API paymentMethod give the same payment label native receipts use.
export const fromWebVoucher = (
  voucher: WebVoucher,
  {
    paymentType,
    paymentMethod,
    branding = {},
    cashierName,
  }: { paymentType?: PaymentType; paymentMethod?: string; branding?: ReceiptBranding; cashierName?: string } = {},
): ReceiptData => {
  const method = fromApiPaymentMethod(paymentMethod);
  const type: PaymentType = paymentType === 'credit' ? 'credit' : 'paid';
  const foc = isFoc(method);
  const subtotal = voucher.subtotal || 0;
  const discount = voucher.discountAmount || 0;
  const serviceCharge = voucher.serviceCharge || 0;
  const tax = voucher.tax || 0;
  const netTotal = voucher.total || 0;
  const paidAmount = foc ? 0 : voucher.paidAmount;
  const date = new Date(voucher.date);

  return {
    invoiceNo: voucher.invoiceNumber,
    date: Number.isNaN(date.getTime()) ? voucher.date : formatReceiptDate(voucher.date),
    customerName: voucher.customerName || undefined,
    customerPhone: voucher.customerPhone || undefined,
    customerAddress: voucher.customerAddress || undefined,
    paymentType: getPaymentLabel({ paymentType: type, paymentMethod: method }),
    items: (voucher.items || []).map((item) => {
      const quantity = getSafeQty(item.qty);
      return { name: item.name, code: item.code || undefined, quantity, price: item.price, subTotal: item.price * quantity };
    }),
    subtotal,
    discount,
    discountPercent: subtotal > 0 ? (discount / subtotal) * 100 : 0,
    // Orders don't store a markup; it's whatever the total is above subtotal less discount plus charges
    markup: Math.max(0, netTotal - (subtotal - discount + serviceCharge + tax)),
    serviceCharge,
    tax,
    netTotal,
    paidAmount,
    changeAmount: type === 'paid' && !foc ? (voucher.change ?? getChangeAmount(paidAmount || 0, netTotal)) : 0,
    dueAmount: type === 'credit' ? Math.max(0, netTotal - (paidAmount || 0)) : 0,
    cashierName: voucher.cashierName || cashierName || undefined,
    note: voucher.note?.trim() || undefined,
    sequenceNumber: getSequenceNumber(voucher.invoiceNumber) ?? voucher.receiptSequenceNumber,
    ...branding,
  };
};

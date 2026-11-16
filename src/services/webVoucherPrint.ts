import { formatReceiptDate } from '../features/pos/lib/receipt';
import type { ReceiptData } from './receiptCaptureService';

interface WebVoucherItem {
  name?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  subTotal?: number;
  total?: number;
}

export interface WebVoucherPayload {
  invoiceNumber?: string;
  invoiceNo?: string;
  date?: string;
  customerName?: string;
  paymentType?: string;
  paymentMethod?: string;
  items?: WebVoucherItem[];
  subtotal?: number;
  subTotal?: number;
  discount?: number;
  discountAmount?: number;
  markupAmount?: number;
  total?: number;
  finalAmount?: number;
  netTotal?: number;
  paidAmount?: number;
  dueAmount?: number;
  change?: number;
  changeAmount?: number;
  cashierName?: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  footerMessage?: string;
}

const paymentLabel = (payload: WebVoucherPayload, paymentType?: string, paymentMethod?: string) => {
  if (paymentType === 'credit') return 'အကြွေး';
  if (paymentType === 'paid' && paymentMethod === 'cash') return 'ငွေသား';
  return paymentMethod || paymentType || undefined;
};

export const toNativeReceiptData = (
  payload: WebVoucherPayload,
  options: { paymentType?: string; paymentMethod?: string } = {},
): ReceiptData => {
  const items = payload.items || [];
  const subtotal = Number(payload.subtotal ?? payload.subTotal ?? 0);
  const discount = Number(payload.discountAmount ?? payload.discount ?? 0);
  const netTotal = Number(payload.total ?? payload.finalAmount ?? payload.netTotal ?? 0);
  const paidAmount = payload.paidAmount === undefined ? undefined : Number(payload.paidAmount);
  const paymentType = options.paymentType || payload.paymentType;

  return {
    invoiceNo: payload.invoiceNumber || payload.invoiceNo || 'UNKNOWN',
    date: payload.date ? formatReceiptDate(payload.date) : formatReceiptDate(new Date().toISOString()),
    customerName: payload.customerName || undefined,
    paymentType: paymentLabel(payload, paymentType, options.paymentMethod || payload.paymentMethod),
    items: items.map((item) => {
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      const price = Number(item.price ?? 0);
      return {
        name: item.name || 'Unknown Product',
        quantity,
        price,
        subTotal: Number(item.subTotal ?? item.total ?? price * quantity),
      };
    }),
    subtotal,
    discount,
    markup: Number(payload.markupAmount ?? 0),
    netTotal,
    paidAmount,
    dueAmount:
      payload.dueAmount !== undefined
        ? Number(payload.dueAmount)
        : paymentType === 'credit' && paidAmount !== undefined
          ? Math.max(0, netTotal - paidAmount)
          : 0,
    changeAmount: Number(payload.change ?? payload.changeAmount ?? 0),
    cashierName: payload.cashierName || undefined,
    shopName: payload.shopName || undefined,
    shopAddress: payload.shopAddress || undefined,
    shopPhone: payload.shopPhone || undefined,
    footerMessage: payload.footerMessage || undefined,
  };
};

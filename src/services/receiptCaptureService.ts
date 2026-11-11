export interface ReceiptItem {
  name: string;
  code?: string;
  quantity: number;
  price: number;
  subTotal: number;
}

export interface ReceiptData {
  invoiceNo: string;
  date: string;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  paymentType?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  discountPercent?: number;
  markup?: number;
  serviceCharge?: number;
  tax?: number;
  netTotal: number;
  paidAmount?: number;
  dueAmount?: number;
  changeAmount?: number;
  cashierName?: string;
  note?: string;
  // The big number at the bottom: the order number's last part, as on the web receipt
  sequenceNumber?: number;
  logoUrl?: string;
  shopName?: string;
  shopAddress?: string;
  shopPhone?: string;
  footerMessage?: string;
}

type CaptureCallback = (receipt: ReceiptData, paperWidth: 58 | 80) => Promise<string>;

let globalCaptureFn: CaptureCallback | null = null;
let captureQueue: Promise<any> = Promise.resolve();

export const receiptCaptureService = {
  registerCapturer(fn: CaptureCallback) {
    globalCaptureFn = fn;
  },

  unregisterCapturer() {
    globalCaptureFn = null;
  },

  async capture(receipt: ReceiptData, paperWidth: 58 | 80): Promise<string> {
    if (!globalCaptureFn) {
      throw new Error('Receipt capture component is not mounted');
    }
    const fn = globalCaptureFn;
    const runWithTimeout = async () => {
      let timer: ReturnType<typeof setTimeout> | null = null;
      try {
        return await Promise.race([
          fn(receipt, paperWidth),
          new Promise<string>((_, reject) => {
            timer = setTimeout(() => {
              reject(new Error('Receipt capture timed out after 8000ms'));
            }, 8000);
          }),
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    };
    const nextTask = captureQueue.then(runWithTimeout, runWithTimeout);
    captureQueue = nextTask.catch(() => {});
    return await nextTask;
  },

  isAvailable(): boolean {
    return !!globalCaptureFn;
  },
};

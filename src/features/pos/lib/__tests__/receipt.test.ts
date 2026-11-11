import type { PosProduct, ShopSettings } from '../../../../services/pos/types';
import type { CompletedSale } from '../../../../store/cartStore';
import { PAYMENT_METHODS } from '../paymentMethods';
import { computeTotals } from '../pricing';
import {
  formatReceiptDate,
  fromWebVoucher,
  getPaymentLabel,
  getSequenceNumber,
  resolveBranding,
  resolveLogo,
  toReceiptData,
} from '../receipt';

const oil: PosProduct = {
  _id: 'oil',
  productName: 'Engine Oil 4L',
  productCode: 'EO-4',
  sellingPrice: 1000,
  availableQuantity: 50,
  wholesalePrices: [{ quantity: 5, price: 900 }],
};
const filter: PosProduct = { _id: 'filter', productName: 'Oil Filter', sellingPrice: 333, availableQuantity: 50 };

const sale = (overrides: Partial<CompletedSale> = {}): CompletedSale => {
  const items = [
    { product: oil, qty: 5 },
    { product: filter, qty: 2 },
  ];
  return {
    order: { _id: 'o1', orderNumber: 'INV/2026/0042' },
    items,
    // 5 x 900 + 2 x 333 = 5166
    totals: computeTotals({ items, priceMode: 'normal', discountPercent: 0, markupAmount: 0 }),
    paymentType: 'paid',
    paymentMethod: PAYMENT_METHODS.CASH,
    paidAmount: 6000,
    customer: null,
    note: '',
    orderDate: '2026-10-23',
    completedAt: new Date(2026, 9, 23, 9, 5).toISOString(),
    ...overrides,
  };
};

const settings: ShopSettings = {
  _id: 's1',
  shopName: 'HONGCHI Myanmar',
  address: 'Yangon',
  phoneNumber: '09-111',
  brandingProfiles: [
    { slot: 1, name: 'Profile One', phoneNumber: '09-222', address: '' },
    { slot: 2, name: '  ', phoneNumber: '', address: 'Mandalay' },
  ],
};

describe('toReceiptData', () => {
  it('maps a paid sale with wholesale prices per line', () => {
    expect(toReceiptData(sale(), { cashierName: 'Ko Aung' })).toEqual({
      invoiceNo: 'INV/2026/0042',
      date: '23/10/2026 09:05',
      customerName: undefined,
      paymentType: 'ငွေသား',
      items: [
        { name: 'Engine Oil 4L', code: 'EO-4', quantity: 5, price: 900, subTotal: 4500 },
        { name: 'Oil Filter', quantity: 2, price: 333, subTotal: 666 },
      ],
      subtotal: 5166,
      discount: 0,
      discountPercent: 0,
      markup: 0,
      netTotal: 5166,
      paidAmount: 6000,
      changeAmount: 834,
      dueAmount: 0,
      cashierName: 'Ko Aung',
      sequenceNumber: 42,
    });
  });

  it('shows what is still owed on credit sales', () => {
    const receipt = toReceiptData(
      sale({
        paymentType: 'credit',
        paidAmount: 2000,
        customer: {
          _id: 'cp1',
          name: 'U Ba',
          phone: '09',
          address: 'Hlaing',
          blacklist: false,
          blacklistReason: null,
          blacklistDate: null,
          createdAt: '',
          updatedAt: '',
        },
      }),
    );
    expect(receipt).toMatchObject({
      paymentType: 'အကြွေး',
      customerName: 'U Ba',
      customerPhone: '09',
      customerAddress: 'Hlaing',
      dueAmount: 3166,
      changeAmount: 0,
    });
  });

  it('carries discounts and markups', () => {
    const items = sale().items;
    const discounted = toReceiptData(
      sale({ totals: computeTotals({ items, priceMode: 'discount', discountPercent: 10, markupAmount: 0 }) }),
    );
    expect(discounted).toMatchObject({ subtotal: 5166, discount: 517, netTotal: 4649 });
    expect(discounted.discountPercent).toBeCloseTo(10.0077, 3);

    const markedUp = toReceiptData(
      sale({ totals: computeTotals({ items, priceMode: 'markup', discountPercent: 0, markupAmount: 300 }) }),
    );
    expect(markedUp).toMatchObject({ markup: 300, netTotal: 5466 });
  });

  it('FOC sales show no payment or change', () => {
    const receipt = toReceiptData(sale({ paymentMethod: PAYMENT_METHODS.FOC, paidAmount: 0 }));
    expect(receipt).toMatchObject({ paymentType: 'အခမဲ့ (FOC)', paidAmount: 0, changeAmount: 0, dueAmount: 0 });
  });

  it('prints the note, trimmed, and leaves out an empty one', () => {
    expect(toReceiptData(sale({ note: '  deliver at 5  ' })).note).toBe('deliver at 5');
    expect(toReceiptData(sale({ note: '   ' })).note).toBeUndefined();
  });

  it('falls back to the order id without an order number', () => {
    expect(toReceiptData(sale({ order: { _id: 'abc123', orderNumber: '' } })).invoiceNo).toBe('abc123');
  });

  it('adds the shop branding', () => {
    expect(toReceiptData(sale(), { branding: resolveBranding(settings, 1) })).toMatchObject({
      shopName: 'Profile One',
      shopPhone: '09-222',
      shopAddress: 'Yangon',
    });
  });
});

describe('resolveBranding', () => {
  it('uses the profile, falling back to the shop for blank fields', () => {
    expect(resolveBranding(settings, 2)).toEqual({
      shopName: 'HONGCHI Myanmar',
      shopPhone: '09-111',
      shopAddress: 'Mandalay',
    });
  });

  it('slot 0 (no logo) uses profile 1', () => {
    expect(resolveBranding(settings, 0).shopName).toBe('Profile One');
  });

  it('a missing profile uses the shop details', () => {
    expect(resolveBranding(settings, 3)).toEqual({
      shopName: 'HONGCHI Myanmar',
      shopPhone: '09-111',
      shopAddress: 'Yangon',
    });
  });

  it('without settings it leaves branding to the template defaults', () => {
    expect(resolveBranding(null)).toEqual({});
  });
});

describe('resolveLogo', () => {
  const withLogos: ShopSettings = {
    ...settings,
    logo: 'https://cdn/legacy.png',
    logos: [
      { slot: 2, url: 'https://cdn/two.png' },
      { slot: 3, url: 'https://cdn/three.png' },
    ],
  };

  it('uses the chosen slot', () => {
    expect(resolveLogo(withLogos, 3)).toBe('https://cdn/three.png');
    expect(resolveBranding(withLogos, 2).logoUrl).toBe('https://cdn/two.png');
  });

  it('slot 1 without its own logo uses the old single logo', () => {
    expect(resolveLogo(withLogos, 1)).toBe('https://cdn/legacy.png');
  });

  it('slot 0 prints no logo', () => {
    expect(resolveLogo(withLogos, 0)).toBeUndefined();
  });

  it('a slot without a logo falls back to any the shop has', () => {
    expect(resolveLogo({ ...withLogos, logo: undefined }, 1)).toBe('https://cdn/two.png');
    expect(resolveLogo(settings, 2)).toBeUndefined();
  });
});

describe('formatting', () => {
  it('formats the date as DD/MM/YYYY HH:mm', () => {
    expect(formatReceiptDate(new Date(2026, 0, 5, 14, 7).toISOString())).toBe('05/01/2026 14:07');
  });

  it('takes the sequence number from the end of the order number', () => {
    expect(getSequenceNumber('INV/2026/0042')).toBe(42);
    expect(getSequenceNumber('INV-ABC')).toBeUndefined();
    expect(getSequenceNumber(undefined)).toBeUndefined();
  });

  it('labels payment methods in Burmese where the web does', () => {
    expect(getPaymentLabel({ paymentType: 'paid', paymentMethod: PAYMENT_METHODS.KBZ_PAY })).toBe('KBZPay');
    expect(getPaymentLabel({ paymentType: 'paid', paymentMethod: PAYMENT_METHODS.BANK_TRANSFER })).toBe(
      'Mobile Banking',
    );
  });
});

describe('fromWebVoucher', () => {
  const voucher = {
    invoiceNumber: 'INV/2026/0077',
    date: new Date(2026, 9, 24, 15, 30).toISOString(),
    items: [{ name: 'Brake Pad', code: 'BP-1', qty: 2, price: 1500 }],
    subtotal: 3000,
    discountPercent: 10,
    discountAmount: 300,
    total: 2700,
    paidAmount: 1000,
    change: 0,
    note: ' call first ',
    serviceCharge: 0,
    tax: 0,
    receiptSequenceNumber: 9999,
    cashierName: 'Ma Hla',
    customerName: 'U Ba',
    customerPhone: '09-5',
  };

  it('lays out a web credit voucher like a native receipt', () => {
    expect(fromWebVoucher(voucher, { paymentType: 'credit', paymentMethod: 'kpay' })).toMatchObject({
      invoiceNo: 'INV/2026/0077',
      date: '24/10/2026 15:30',
      paymentType: 'အကြွေး',
      items: [{ name: 'Brake Pad', code: 'BP-1', quantity: 2, price: 1500, subTotal: 3000 }],
      discount: 300,
      discountPercent: 10,
      markup: 0,
      netTotal: 2700,
      paidAmount: 1000,
      changeAmount: 0,
      dueAmount: 1700,
      note: 'call first',
      sequenceNumber: 77,
      cashierName: 'Ma Hla',
      customerName: 'U Ba',
    });
  });

  it('labels paid and FOC vouchers from the API payment method', () => {
    expect(fromWebVoucher({ ...voucher, paidAmount: 3000, change: 300 }, { paymentMethod: 'wavepay' })).toMatchObject({
      paymentType: 'WavePay',
      changeAmount: 300,
      dueAmount: 0,
    });
    expect(fromWebVoucher(voucher, { paymentMethod: 'foc' })).toMatchObject({ paymentType: 'အခမဲ့ (FOC)', paidAmount: 0 });
  });

  it('reads a total above the adjusted subtotal as a markup', () => {
    expect(fromWebVoucher({ ...voucher, discountAmount: 0, total: 3200 }).markup).toBe(200);
  });
});

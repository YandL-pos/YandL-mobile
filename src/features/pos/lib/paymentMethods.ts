import type { ApiPaymentMethod } from '../../../services/pos/types';

// Display values, same as the web POS's PaymentMethod enum
export const PAYMENT_METHODS = {
  CASH: 'Cash',
  KBZ_PAY: 'KBZPay',
  WAVE_PAY: 'WavePay',
  AYA_PAY: 'AYA Pay',
  UAB_PAY: 'UAB Pay',
  MMQR: 'MMQR',
  BANK_TRANSFER: 'Bank Transfer',
  NORMAL: 'Normal',
  HOT: 'Hot',
  FOC: 'FOC',
} as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

const TO_API: Record<PaymentMethod, ApiPaymentMethod> = {
  [PAYMENT_METHODS.CASH]: 'cash',
  [PAYMENT_METHODS.KBZ_PAY]: 'kpay',
  [PAYMENT_METHODS.WAVE_PAY]: 'wavepay',
  [PAYMENT_METHODS.AYA_PAY]: 'ayapay',
  [PAYMENT_METHODS.UAB_PAY]: 'uabpay',
  [PAYMENT_METHODS.MMQR]: 'MMQR',
  [PAYMENT_METHODS.BANK_TRANSFER]: 'bank_transfer',
  [PAYMENT_METHODS.NORMAL]: 'normal',
  [PAYMENT_METHODS.HOT]: 'hot',
  [PAYMENT_METHODS.FOC]: 'foc',
};

export const toApiPaymentMethod = (method: PaymentMethod): ApiPaymentMethod => TO_API[method];

// Orders loaded for editing carry the API value; anything unknown falls back to cash like the web POS
export const fromApiPaymentMethod = (value: string | null | undefined): PaymentMethod => {
  const match = (Object.keys(TO_API) as PaymentMethod[]).find((method) => TO_API[method] === value);
  return match ?? PAYMENT_METHODS.CASH;
};

// The methods the checkout screen offers (FOC is chosen through the payment type instead)
export const SELECTABLE_PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: PAYMENT_METHODS.CASH, label: 'ငွေသား' },
  { id: PAYMENT_METHODS.KBZ_PAY, label: 'KBZPay' },
  { id: PAYMENT_METHODS.WAVE_PAY, label: 'WavePay' },
  { id: PAYMENT_METHODS.AYA_PAY, label: 'AYA Pay' },
  { id: PAYMENT_METHODS.BANK_TRANSFER, label: 'Mobile Banking' },
  { id: PAYMENT_METHODS.MMQR, label: 'MMQR' },
];

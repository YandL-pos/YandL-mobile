import type { CartError } from './cart';
import type { CheckoutError } from './checkout';

// Burmese wording from the web POS (translations/my.ts and POS.tsx)
export const CART_ERROR_MESSAGES: Record<CartError, string> = {
  OUT_OF_STOCK: 'လက်ကျန် ကုန်သွားပါပြီ!',
  EXCEEDS_STOCK: 'ရရှိနိုင်သော လက်ကျန်ထက် မကျော်လွန်နိုင်ပါ',
  INVALID_QUANTITY: 'Wholesale အရေအတွက် မမှန်ကန်ပါ',
};

export const CHECKOUT_ERROR_MESSAGES: Record<CheckoutError, string> = {
  EMPTY_CART: 'ခြင်းတောင်းထဲတွင် ပစ္စည်းမရှိသေးပါ',
  PAID_LESS_THAN_TOTAL: 'ပေးချေပမာဏသည် စုစုပေါင်းပမာဏနှင့် အနည်းဆုံး ညီမျှရမည်',
  CUSTOMER_REQUIRED: 'အကြွေးပေးသူ (Customer) ရွေးချယ်ပေးပါ',
  CREDIT_PAID_EXCEEDS_TOTAL: 'ပေးချေငွေသည် ကျသင့်ငွေထက် မကျော်လွန်ရပါ',
};

// Myanmar Unicode font used on printed receipts, the same one offline-pos uses.
// Loaded at runtime in the root layout, so it needs no native rebuild.
export const RECEIPT_FONT = 'Z06-Walone';

export const APP_FONTS = {
  [RECEIPT_FONT]: require('../assets/font/Z06-Walone Regular.ttf'),
};

// Colours from the web POS, so both look like one product
export const colors = {
  primary: '#2216a8',
  primaryDark: '#1e1b4b',
  primarySoft: '#EEF2FF',
  background: '#F5F4EF',
  surface: '#ffffff',
  text: '#1f2937',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  border: '#d1d5db',
  borderSoft: '#e5e7eb',
  danger: '#dc2626',
  dangerSoft: '#fee2e2',
  success: '#15803d',
  successSoft: '#dcfce7',
  warning: '#b45309',
  warningSoft: '#fef3c7',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

export const formatNumber = (value: number) => Number(value || 0).toLocaleString('en-US');

export const formatMMK = (value: number) => `${formatNumber(value)} MMK`;

const BURMESE_DIGITS = '၀၁၂၃၄၅၆၇၈၉';

// 12 -> ၁၂, for counts shown in Burmese sentences
export const toBurmeseNumber = (value: number) =>
  String(value).replace(/[0-9]/g, (digit) => BURMESE_DIGITS[Number(digit)]);

// Width at which the POS switches to its tablet layout (2 product columns instead of 1, wider popups)
export const TABLET_MIN_WIDTH = 650;

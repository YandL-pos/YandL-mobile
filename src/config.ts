// Override per build with EXPO_PUBLIC_WEB_APP_URL (e.g. the local Vite dev server while developing).
export const WEB_APP_URL = (
  process.env.EXPO_PUBLIC_WEB_APP_URL ||
  'https://yandl-frontend.pages.dev'
).replace(/\/+$/, '');

// Override per build with EXPO_PUBLIC_API_BASE_URL (e.g. a local backend while developing).
// TODO: replace the fallback with the YandL production backend URL.
export const API_BASE_URL = (
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  'https://yandl-backend-production.up.railway.app/api/v1/'
).replace(/\/+$/, '');

export const API_TIMEOUT_MS = 20000;

// Send the web app's /pos (new sale) to the native POS screen, which prints over Bluetooth.
// On unless EXPO_PUBLIC_NATIVE_POS is "0": `eas update` bundles don't get the build profile's env,
// so an update published without the variable must not switch the native POS off.
export const NATIVE_POS_ENABLED = process.env.EXPO_PUBLIC_NATIVE_POS !== '0';

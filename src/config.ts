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

// Send the web app's /pos (new sale) to the native POS screen. On for `expo start` (.env.development)
// and preview builds (eas.json); stays off in production until the native POS is finished.
export const NATIVE_POS_ENABLED = process.env.EXPO_PUBLIC_NATIVE_POS === '1';

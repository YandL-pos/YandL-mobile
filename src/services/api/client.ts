import { API_BASE_URL, API_TIMEOUT_MS } from '../../config';
import { useAuthStore } from '../../store/authStore';

type QueryValue = string | number | boolean | null | undefined;

interface RequestOptions {
  params?: Record<string, QueryValue>;
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const buildUrl = (path: string, params?: Record<string, QueryValue>) => {
  const query = Object.entries(params || {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');
  const url = `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
  return query ? `${url}?${query}` : url;
};

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  const token = useAuthStore.getState().token;
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.params), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError('အင်တာနက် ချိတ်ဆက်မှုကို စစ်ဆေးပါ။ (Network error)', 0);
  } finally {
    clearTimeout(timer);
  }

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Non-JSON body (e.g. an HTML error page from the proxy)
  }

  if (!response.ok) {
    if (response.status === 401) {
      // Token expired or invalid; the WebView login page issues a new one
      useAuthStore.getState().logout();
    }
    throw new ApiError(
      data?.message || data?.error || `Request failed (${response.status})`,
      response.status,
      data?.code,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, params?: RequestOptions['params']) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

export const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

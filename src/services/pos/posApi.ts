import { api, getErrorMessage } from '../api/client';
import type {
  ApiResponse,
  CreateCreditPersonaPayload,
  CreateOrderRequest,
  CreditPersona,
  FetchCreditPersonasParams,
  FetchProductsParams,
  FetchProductsResponse,
  PosOrder,
  ShopSettings,
} from './types';

// Like the web services, these never throw: failures come back as { success: false, message }
const failure = <T>(error: unknown, fallback: string, data: T): ApiResponse<T> => {
  console.warn(fallback, error);
  return { success: false, message: getErrorMessage(error, fallback), data };
};

export const fetchProducts = async (
  params: FetchProductsParams = {},
): Promise<FetchProductsResponse> => {
  try {
    return await api.get<FetchProductsResponse>('/inventory', {
      ...params,
      category: params.category && params.category !== 'All' ? params.category : undefined,
    });
  } catch (error) {
    return failure(error, 'Failed to fetch products', []);
  }
};

export const fetchCategories = async (): Promise<ApiResponse<string[]>> => {
  try {
    return await api.get<ApiResponse<string[]>>('/inventory/categories');
  } catch (error) {
    return failure(error, 'Failed to fetch categories', []);
  }
};

export const createOrder = async (
  payload: CreateOrderRequest,
): Promise<ApiResponse<PosOrder | null>> => {
  try {
    return await api.post<ApiResponse<PosOrder>>('/order', payload);
  } catch (error) {
    return failure(error, 'Failed to create order', null);
  }
};

export const fetchCreditPersonas = async (
  params: FetchCreditPersonasParams = {},
): Promise<ApiResponse<CreditPersona[]>> => {
  try {
    return await api.get<ApiResponse<CreditPersona[]>>('/credit-persona', { ...params });
  } catch (error) {
    return failure(error, 'Failed to fetch credit personas', []);
  }
};

export const createCreditPersona = async (
  payload: CreateCreditPersonaPayload,
): Promise<ApiResponse<CreditPersona | null>> => {
  try {
    return await api.post<ApiResponse<CreditPersona>>('/credit-persona', payload);
  } catch (error) {
    return failure(error, 'Failed to create credit persona', null);
  }
};

export const fetchShopSettings = async (): Promise<ApiResponse<ShopSettings | null>> => {
  try {
    return await api.get<ApiResponse<ShopSettings>>('/shop-settings');
  } catch (error) {
    return failure(error, 'Failed to fetch shop settings', null);
  }
};

import { api, getErrorMessage } from '../api/client';
import type {
  ApiResponse,
  CreateCreditPersonaPayload,
  CreateOrderRequest,
  CreditPersona,
  FetchCreditPersonasParams,
  FetchProductsParams,
  FetchProductsResponse,
  Pagination,
  PosOrder,
  PosProduct,
  ShopSettings,
  StorefrontProfile,
  StorefrontStockItem,
} from './types';

// Like the web services, these never throw: failures come back as { success: false, message }
const failure = <T>(error: unknown, fallback: string, data: T): ApiResponse<T> => {
  console.warn(fallback, error);
  return { success: false, message: getErrorMessage(error, fallback), data };
};

export const fetchStorefronts = async (): Promise<ApiResponse<StorefrontProfile[]>> => {
  try {
    return await api.get<ApiResponse<StorefrontProfile[]>>('/storefront-profile', { page: 1, limit: 100 });
  } catch (error) {
    return failure(error, 'Failed to fetch storefronts', []);
  }
};

// Stock rows (one per batch) become one POS product per inventory item, with the batches' stock added up.
// The product's _id is the inventory id, which is what an order line refers to.
const toPosProducts = (rows: StorefrontStockItem[]): PosProduct[] => {
  const byId = new Map<string, PosProduct>();
  for (const row of rows) {
    const inv = row.inventoryId;
    if (!inv) continue;
    // Same stock field the web POS reads
    const stock = Number(row.availableQuantity ?? row.quantity ?? 0) || 0;
    const existing = byId.get(inv._id);
    if (existing) {
      existing.availableQuantity = (existing.availableQuantity ?? 0) + stock;
      continue;
    }
    byId.set(inv._id, {
      _id: inv._id,
      productName: inv.productName,
      productCode: inv.productCode,
      SKU: inv.SKU,
      category: inv.category,
      sellingPrice: inv.sellingPrice ?? 0,
      buyingPrice: inv.buyingPrice,
      wholesalePrices: inv.wholesalePrices,
      availableQuantity: stock,
    });
  }
  return [...byId.values()];
};

// The storefront's stock, the same list the web POS shows (GET /storefront-inventory)
export const fetchProducts = async ({
  storefrontId,
  page = 1,
  limit = 100,
  category,
  search,
  inventoryId,
}: FetchProductsParams): Promise<FetchProductsResponse> => {
  try {
    const res = await api.get<ApiResponse<StorefrontStockItem[]> & { pagination?: Pagination }>(
      '/storefront-inventory',
      {
        storefrontId,
        page,
        limit,
        category: category && category !== 'All' ? category : undefined,
        search: search?.trim() || undefined,
        inventoryId,
      },
    );
    return { ...res, data: res.success ? toPosProducts(res.data || []) : [] };
  } catch (error) {
    return failure(error, 'Failed to fetch products', []);
  }
};

// A few requests at a time, so a big sale doesn't flood the backend
const FETCH_CONCURRENCY = 4;

// Current stock of some products in one storefront (e.g. the ones just sold), keyed by product id.
// Products that can't be read are left out.
export const fetchProductsByIds = async (storefrontId: string, ids: string[]): Promise<Map<string, PosProduct>> => {
  const products = new Map<string, PosProduct>();
  for (let i = 0; i < ids.length; i += FETCH_CONCURRENCY) {
    const batch = ids.slice(i, i + FETCH_CONCURRENCY);
    const results = await Promise.all(
      batch.map((inventoryId) => fetchProducts({ storefrontId, inventoryId, page: 1, limit: 10 })),
    );
    results.forEach((res, index) => {
      const product = res.success ? res.data.find((p) => p._id === batch[index]) : undefined;
      if (product) products.set(batch[index], product);
    });
  }
  return products;
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

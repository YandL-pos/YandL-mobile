// Shapes returned by the YandL backend (/api/v1), mirrored from yandl-frontend services

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface WholesalePrice {
  quantity: number;
  price: number;
}

export interface PosProduct {
  _id: string;
  productName: string;
  productCode?: string;
  SKU?: string;
  category?: string;
  sellingPrice: number;
  wholesalePrices?: WholesalePrice[];
  availableQuantity?: number;
  quantity?: number;
  stockShop?: number;
  status?: 'active' | 'inactive';
}

export interface FetchProductsParams {
  // Stock is read from this storefront, as on the web POS
  storefrontId: string;
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

// GET /storefront-profile
export interface StorefrontProfile {
  _id: string;
  locationCode: string;
  locationName: string;
  status: 'active' | 'inactive';
}

// One row of GET /storefront-inventory: a product's stock in one storefront
export interface StorefrontStockItem {
  _id: string;
  inventoryId: {
    _id: string;
    productName: string;
    productCode?: string;
    SKU?: string;
    category?: string;
    sellingPrice?: number;
    wholesalePrices?: WholesalePrice[];
  } | null;
  // Stock left to sell; the backend may only send quantity, so read it as availableQuantity ?? quantity
  availableQuantity?: number | null;
  quantity?: number | null;
}

export interface FetchProductsResponse extends ApiResponse<PosProduct[]> {
  pagination?: Pagination;
}

// Values the backend accepts for paymentMethod
export type ApiPaymentMethod =
  | 'cash'
  | 'kpay'
  | 'wavepay'
  | 'ayapay'
  | 'uabpay'
  | 'MMQR'
  | 'bank_transfer'
  | 'normal'
  | 'hot'
  | 'foc';

export interface OrderProductInput {
  inventoryId: string;
  quantity: number;
}

export interface CreateOrderRequest {
  storefrontId?: string;
  ordersProducts: OrderProductInput[];
  subTotal: number;
  tax?: number;
  discount: number;
  finalAmount: number;
  paidAmount: number;
  paymentType: 'paid' | 'credit';
  paymentMethod: ApiPaymentMethod;
  note?: string;
  orderDate?: string;
  creditPersonId?: string;
}

export interface PosOrder {
  _id: string;
  orderNumber: string;
  [key: string]: unknown;
}

export interface CreditPersona {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  blacklist: boolean;
  blacklistReason: string | null;
  blacklistDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FetchCreditPersonasParams {
  page?: number;
  limit?: number;
  search?: string;
  blacklist?: boolean;
  all?: boolean;
}

export interface CreateCreditPersonaPayload {
  name: string;
  phone: string;
  address?: string;
}

export interface BrandingProfile {
  slot: number;
  name?: string;
  phoneNumber?: string;
  address?: string;
}

export interface ShopSettings {
  _id: string;
  shopName: string;
  address: string;
  phoneNumber: string;
  formattedPhoneNumber?: string;
  logo?: string;
  brandingProfiles?: BrandingProfile[];
  currency?: string;
  taxRate?: number;
}

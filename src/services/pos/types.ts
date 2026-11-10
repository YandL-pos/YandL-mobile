// Shapes returned by the commercial backend (/api/v1), mirrored from Autoshop-Frontend services

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
  page?: number;
  limit?: number;
  category?: string;
  status?: 'active' | 'inactive';
  search?: string;
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

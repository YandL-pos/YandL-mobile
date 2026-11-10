import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchCategories,
  fetchCreditPersonas,
  fetchProducts,
  fetchStorefronts,
} from '../../../services/pos/posApi';
import type { CreditPersona, Pagination, PosProduct, StorefrontProfile } from '../../../services/pos/types';
import { useShopStore } from '../../../store/shopStore';

const PAGE_SIZE = 40;

export const useDebouncedValue = <T>(value: T, delayMs = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

interface ProductPage {
  key: string;
  products: PosProduct[];
  pagination?: Pagination;
  error?: string;
}

/**
 * The storefront the POS sells from, like the web POS: the one last picked there, else the first
 * active one. Also kept in the shop store so checkout can send it with the order.
 */
export const useStorefront = () => {
  const preferredId = useShopStore((state) => state.preferredStorefrontId);
  const setPosStorefront = useShopStore((state) => state.setPosStorefront);
  const [storefronts, setStorefronts] = useState<StorefrontProfile[] | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    fetchStorefronts().then((res) => {
      if (cancelled) return;
      if (res.success) setStorefronts(res.data.filter((sf) => sf.status === 'active'));
      else setError(res.message);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const storefront = storefronts
    ? storefronts.find((sf) => sf._id === preferredId) ?? storefronts[0] ?? null
    : null;

  useEffect(() => {
    setPosStorefront(storefront);
  }, [storefront, setPosStorefront]);

  return {
    storefront,
    error: error ?? (storefronts && !storefront ? 'Storefront မရှိသေးပါ။ Web app မှာ storefront အရင်ထည့်ပါ။' : undefined),
  };
};

/**
 * The storefront's products for the POS grid, a page at a time. Nothing loads until there is a storefront.
 * Changing the search, the category or `reloadToken` loads page 1 again; the previous list
 * stays on screen meanwhile, so `isLoading` is only true before the very first result.
 */
export const useProducts = ({
  storefrontId,
  search,
  category,
  reloadToken,
}: {
  storefrontId: string | undefined;
  search: string;
  category: string;
  reloadToken: string | number;
}) => {
  const key = `${storefrontId}|${search}|${category}|${reloadToken}`;
  const [page, setPage] = useState<ProductPage | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    if (!storefrontId) return;
    let cancelled = false;
    fetchProducts({ storefrontId, page: 1, limit: PAGE_SIZE, category, search }).then((res) => {
      if (cancelled) return;
      setPage({
        key,
        products: res.success ? res.data : [],
        pagination: res.pagination,
        error: res.success ? undefined : res.message,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [key, storefrontId, search, category]);

  const hasMore =
    !!page && page.key === key && !!page.pagination && page.pagination.currentPage < page.pagination.totalPages;

  const loadMore = useCallback(async () => {
    if (!page || !hasMore || !storefrontId || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const nextPage = (page.pagination?.currentPage ?? 1) + 1;
    const res = await fetchProducts({ storefrontId, page: nextPage, limit: PAGE_SIZE, category, search });
    // Drop the page if the search changed while it loaded
    setPage((current) => {
      if (!current || current.key !== page.key || !res.success) return current;
      const seen = new Set(current.products.map((p) => p._id));
      return {
        ...current,
        products: [...current.products, ...res.data.filter((p) => !seen.has(p._id))],
        pagination: res.pagination,
      };
    });
    loadingMoreRef.current = false;
    setIsLoadingMore(false);
  }, [page, hasMore, storefrontId, category, search]);

  return {
    products: page?.products ?? [],
    totalItems: page?.pagination?.totalItems ?? page?.products.length ?? 0,
    error: page?.key === key ? page.error : undefined,
    isLoading: page === null,
    isRefreshing: page !== null && page.key !== key,
    isLoadingMore,
    hasMore,
    loadMore,
  };
};

export const useCategories = () => {
  const [categories, setCategories] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchCategories().then((res) => {
      if (!cancelled && res.success) setCategories(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return categories;
};

// Customers who can take credit (blacklisted ones are left out, as on the web POS)
export const useCreditPersonas = () => {
  const [personas, setPersonas] = useState<CreditPersona[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchCreditPersonas({ all: true }).then((res) => {
      if (cancelled) return;
      if (res.success) setPersonas(res.data.filter((p) => !p.blacklist));
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A customer just created from the checkout screen goes to the top of the list
  const addPersona = useCallback((persona: CreditPersona) => {
    setPersonas((current) => [persona, ...current.filter((p) => p._id !== persona._id)]);
  }, []);

  return { personas, isLoading, addPersona };
};

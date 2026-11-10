import { useCallback, useEffect, useRef, useState } from 'react';

import {
  fetchCategories,
  fetchCreditPersonas,
  fetchProducts,
} from '../../../services/pos/posApi';
import type { CreditPersona, Pagination, PosProduct } from '../../../services/pos/types';

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
 * Active products for the POS grid, a page at a time.
 * Changing the search, the category or `reloadToken` loads page 1 again; the previous list
 * stays on screen meanwhile, so `isLoading` is only true before the very first result.
 */
export const useProducts = ({
  search,
  category,
  reloadToken,
}: {
  search: string;
  category: string;
  reloadToken: string | number;
}) => {
  const key = `${search}|${category}|${reloadToken}`;
  const [page, setPage] = useState<ProductPage | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    fetchProducts({ page: 1, limit: PAGE_SIZE, category, status: 'active', search }).then((res) => {
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
  }, [key, search, category]);

  const hasMore =
    !!page && page.key === key && !!page.pagination && page.pagination.currentPage < page.pagination.totalPages;

  const loadMore = useCallback(async () => {
    if (!page || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    const nextPage = (page.pagination?.currentPage ?? 1) + 1;
    const res = await fetchProducts({ page: nextPage, limit: PAGE_SIZE, category, status: 'active', search });
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
  }, [page, hasMore, category, search]);

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

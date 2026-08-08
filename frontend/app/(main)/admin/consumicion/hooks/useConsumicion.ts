"use client";

import { useState, useCallback } from "react";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { api, type UserProductAdmin } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

export type ShopFilter = "flourish" | "borgin";

export interface ConsumicionFilters {
  shop: ShopFilter;
  search: string;
  dateFrom: string;
  dateTo: string;
}

export function useConsumicion(initialShop: ShopFilter = "flourish") {
  const [shop, setShop] = useState<ShopFilter>(initialShop);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const fetcher = useCallback(
    async (pagination: { skip: number; limit: number }) => {
      return api.getInventory(
        shop,
        debouncedSearch || undefined,
        dateFrom || undefined,
        dateTo || undefined,
        pagination
      );
    },
    [shop, debouncedSearch, dateFrom, dateTo]
  );

  const paginated = usePaginatedList<UserProductAdmin>({
    fetcher,
    pageSize: 12,
    queryKey: ["admin-consumicion", shop, debouncedSearch, dateFrom, dateTo],
    resetKey: shop,
  });

  const removeItem = useCallback(
    async (userProductId: string, quantity: number) => {
      const response = await api.removeInventoryItem(userProductId, quantity);
      await paginated.refresh();
      return response;
    },
    [paginated]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
  }, []);

  return {
    shop,
    setShop,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearFilters,
    items: paginated.items,
    hasMore: paginated.hasMore,
    loading: paginated.loading,
    loadingMore: paginated.loadingMore,
    error: paginated.error,
    totalLoaded: paginated.totalLoaded,
    totalCount: paginated.totalCount,
    loadMore: paginated.loadMore,
    refresh: paginated.refresh,
    removeItem,
  };
}
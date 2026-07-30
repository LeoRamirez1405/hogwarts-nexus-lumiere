"use client";

import { useState, useCallback, useRef, useEffect } from "react";

export interface Page<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
  has_more: boolean;
}

export interface UsePaginatedListOptions<T> {
  fetcher: (pagination: { skip: number; limit: number }) => Promise<Page<T>>;
  pageSize: number;
  enabled?: boolean;
  /**
   * When this value changes, the list resets and refetches from page 0.
   * Use it for server-side filters/tabs (e.g. the active category) so the
   * fetcher's new criteria actually take effect. Leave undefined for lists
   * with no server-side filter — they just load once on mount.
   */
  resetKey?: unknown;
}

export interface UsePaginatedListResult<T> {
  items: T[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  totalLoaded: number;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function usePaginatedList<T>(
  options: UsePaginatedListOptions<T>,
): UsePaginatedListResult<T> {
  const { fetcher, pageSize, enabled = true, resetKey } = options;

  const [items, setItems] = useState<T[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  // The page passes a brand-new fetcher closure every render; keep the latest
  // in a ref so `loadPage` stays stable and we only refetch when `enabled` or
  // `resetKey` change — not on every render.
  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  // Monotonic id so a slow response from a superseded fetch (e.g. the user
  // switched tabs mid-request) is ignored instead of clobbering the current one.
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (skip: number, append: boolean) => {
      const reqId = ++requestIdRef.current;
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setLoadingMore(false); // a fresh load cancels any pending "load more"
      }
      try {
        const page = await fetcherRef.current({ skip, limit: pageSize });
        if (reqId !== requestIdRef.current) return;
        const pageItems = page.items;
        if (append) {
          setItems((prev) => [...prev, ...pageItems]);
        } else {
          setItems(pageItems);
        }
        setHasMore(page.has_more);
        setTotalCount(page.total);
        setError(null);
      } catch (e: unknown) {
        if (reqId === requestIdRef.current) {
          setError(e instanceof Error ? e.message : "Error al cargar");
        }
      } finally {
        if (reqId === requestIdRef.current) {
          if (append) setLoadingMore(false);
          else setLoading(false);
        }
      }
    },
    [pageSize],
  );

  const refresh = useCallback(async () => {
    await loadPage(0, false);
  }, [loadPage]);

  // Load the first page on mount, when `enabled` flips on, and whenever
  // `resetKey` changes (e.g. the active tab/filter) — refetching with the
  // fetcher's new criteria. While loading, callers render a skeleton, so the
  // previous page's items stay until `loadPage` replaces them on resolve.
  useEffect(() => {
    if (!enabled) return;
    // Intentional data fetch on mount / filter change: loadPage updates loading
    // + list state, which is exactly the point here (not derived-state churn).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadPage(0, false);
  }, [enabled, resetKey, loadPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await loadPage(items.length, true);
  }, [loadingMore, hasMore, loadPage, items.length]);

  return {
    items,
    hasMore,
    loading,
    loadingMore,
    error,
    totalLoaded: items.length,
    totalCount,
    loadMore,
    refresh,
  };
}

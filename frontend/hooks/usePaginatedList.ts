"use client";

import { useInfiniteQuery } from "@tanstack/react-query";

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
   * Stable React Query key identifying this list. Include any server-side
   * filter values (category, profileId, house, etc.) so React Query can
   * cache distinct queries per filter. Without this there is no cross-page
   * caching.
   */
  queryKey: unknown[];
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
  const { fetcher, pageSize, enabled = true, queryKey, resetKey } = options;

  const {
    data,
    isPending,
    isFetchingNextPage,
    isError,
    error,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: [...queryKey, resetKey],
    queryFn: ({ pageParam }) =>
      fetcher({ skip: pageParam as number, limit: pageSize }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.skip + lastPage.limit : undefined,
    enabled,
  });

  const items = (data?.pages ?? []).flatMap((p) => p.items);

  const loadMore = async () => {
    if (isFetchingNextPage || !hasNextPage) return;
    await fetchNextPage();
  };

  const refresh = async () => {
    await refetch();
  };

  return {
    items,
    hasMore: hasNextPage ?? false,
    loading: isPending,
    loadingMore: isFetchingNextPage,
    error: isError
      ? error instanceof Error
        ? error.message
        : "Error al cargar"
      : null,
    totalLoaded: items.length,
    totalCount: data?.pages?.[0]?.total ?? 0,
    loadMore,
    refresh,
  };
}

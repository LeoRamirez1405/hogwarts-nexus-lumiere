"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api, Article } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

export interface UseArticlesListOptions {
  initialSearch?: string;
  initialCategory?: string;
  initialFeaturedOnly?: boolean;
  pageSize?: number;
  enabled?: boolean;
  onError?: (error: Error) => void;
}

export interface UseArticlesListResult {
  articles: Article[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  totalLoaded: number;
  totalCount: number;
  search: string;
  setSearch: (value: string) => void;
  debouncedSearch: string;
  category: string;
  setCategory: (value: string) => void;
  featuredOnly: boolean;
  setFeaturedOnly: (value: boolean) => void;
  categories: string[];
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
}

export function useArticlesList(
  options: UseArticlesListOptions = {}
): UseArticlesListResult {
  const {
    initialSearch = "",
    initialCategory = "",
    initialFeaturedOnly = false,
    pageSize = 20,
    enabled = true,
    onError,
  } = options;

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalLoaded, setTotalLoaded] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const [featuredOnly, setFeaturedOnly] = useState(initialFeaturedOnly);
  const [categories, setCategories] = useState<string[]>([]);
  const pageRef = useRef(0);

  const debouncedSearch = useDebounce(search, 300);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.getArticleCategories();
      setCategories(data);
    } catch (e) {
      console.error("Failed to fetch categories:", e);
    }
  }, []);

  const fetchArticles = useCallback(
    async (pageNum = 1, append = false) => {
      if (!enabled) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        const params: Record<string, string> = {
          limit: String(pageSize),
          offset: String((pageNum - 1) * pageSize),
        };
        if (debouncedSearch) params.search = debouncedSearch;
        if (category && category !== "all") params.category = category;
        if (featuredOnly) params.featured_only = "true";

        const data = await api.getArticles(params);

        if (append) {
          setArticles((prev) => [...prev, ...data.items]);
        } else {
          setArticles(data.items);
        }

        setHasMore(data.has_more);
        setTotalLoaded(data.items.length);
        setTotalCount(data.total);
        pageRef.current = pageNum;
      } catch (e) {
        if (!append) setArticles([]);
        setHasMore(false);
        if (onError) onError(e as Error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [debouncedSearch, category, featuredOnly, pageSize, enabled, onError]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!enabled) return;
    pageRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticles(1, false);
  }, [fetchArticles, enabled]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    await fetchArticles(pageRef.current + 1, true);
  }, [fetchArticles, loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    pageRef.current = 0;
    await fetchArticles(1, false);
  }, [fetchArticles]);

  const reset = useCallback(() => {
    setArticles([]);
    setLoading(false);
    setLoadingMore(false);
    setHasMore(true);
    setTotalLoaded(0);
    setTotalCount(0);
    pageRef.current = 0;
  }, []);

  return {
    articles,
    loading,
    loadingMore,
    hasMore,
    totalLoaded,
    totalCount,
    search,
    setSearch,
    debouncedSearch,
    category,
    setCategory,
    featuredOnly,
    setFeaturedOnly,
    categories,
    loadMore,
    refresh,
    reset,
  };
}
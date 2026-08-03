"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { api, Article, Announcement, Classified } from "@/lib/api";

export interface UseNewsPageResult {
  // Articles
  articles: Article[];
  featuredArticles: Article[];
  articlesHasMore: boolean;
  articlesLoading: boolean;
  articlesLoadingMore: boolean;
  articlesTotal: number;
  articlesTotalCount: number;
  loadMoreArticles: () => Promise<void>;
  refreshArticles: () => Promise<void>;

  // Featured articles
  featuredHasMore: boolean;
  featuredLoading: boolean;
  featuredLoadingMore: boolean;
  featuredTotal: number;
  featuredTotalCount: number;
  loadMoreFeatured: () => Promise<void>;
  refreshFeatured: () => Promise<void>;

  // Announcements
  announcements: Announcement[];
  announcementsLoading: boolean;

  // Classifieds
  classifieds: Classified[];
  classifiedsLoading: boolean;

  // Saved articles
  savedArticles: Article[];
  savedHasMore: boolean;
  savedLoading: boolean;
  savedLoadingMore: boolean;
  savedTotal: number;
  savedTotalCount: number;
  loadMoreSaved: () => Promise<void>;
  refreshSaved: () => Promise<void>;

  // Overall loading
  loading: boolean;
  loadError: string | null;
  retry: () => void;
}

export function useNewsPage(): UseNewsPageResult {
  const [articles, setArticles] = useState<Article[]>([]);
  const [featuredArticles, setFeaturedArticles] = useState<Article[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [savedArticles, setSavedArticles] = useState<Article[]>([]);

  const [articlesHasMore, setArticlesHasMore] = useState(false);
  const [featuredHasMore, setFeaturedHasMore] = useState(false);
  const [savedHasMore, setSavedHasMore] = useState(false);

  const [articlesLoading, setArticlesLoading] = useState(true);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [announcementsLoading, setAnnouncementsLoading] = useState(true);
  const [classifiedsLoading, setClassifiedsLoading] = useState(true);
  const [savedLoading, setSavedLoading] = useState(true);

  const [articlesLoadingMore, setArticlesLoadingMore] = useState(false);
  const [featuredLoadingMore, setFeaturedLoadingMore] = useState(false);
  const [savedLoadingMore, setSavedLoadingMore] = useState(false);

  const [articlesTotal, setArticlesTotal] = useState(0);
  const [articlesTotalCount, setArticlesTotalCount] = useState(0);
  const [featuredTotal, setFeaturedTotal] = useState(0);
  const [featuredTotalCount, setFeaturedTotalCount] = useState(0);
  const [savedTotal, setSavedTotal] = useState(0);
  const [savedTotalCount, setSavedTotalCount] = useState(0);

  const [loadError, setLoadError] = useState<string | null>(null);

  // Pagination refs
  const articlesSkipRef = useRef(0);
  const featuredSkipRef = useRef(0);
  const savedSkipRef = useRef(0);
  const initialLoadRef = useRef(true);

  const fetchAll = useCallback(async (reset = false) => {
    if (reset) {
      setLoadError(null);
      setArticlesLoading(true);
      setAnnouncementsLoading(true);
      setClassifiedsLoading(true);
      setSavedLoading(true);
      articlesSkipRef.current = 0;
      featuredSkipRef.current = 0;
      savedSkipRef.current = 0;
    }

    try {
      const state = await api.getNewsFullState({
        articles_skip: articlesSkipRef.current,
        articles_limit: 9,
        featured_skip: featuredSkipRef.current,
        featured_limit: 9,
        saved_skip: savedSkipRef.current,
        saved_limit: 9,
        announcements_limit: 20,
        classifieds_limit: 20,
      });

      if (reset) {
        setArticles(state.articles);
        setFeaturedArticles(state.featured_articles);
        setSavedArticles(state.saved_articles);
      } else {
        setArticles((prev) => [...prev, ...state.articles]);
        setFeaturedArticles((prev) => [...prev, ...state.featured_articles]);
        setSavedArticles((prev) => [...prev, ...state.saved_articles]);
      }

      setAnnouncements(state.announcements);
      setClassifieds(state.classifieds);

      setArticlesHasMore(state.articles_has_more);
      setFeaturedHasMore(state.featured_articles_has_more);
      setSavedHasMore(state.saved_articles_has_more);

      setArticlesTotal(state.articles.length);
      setArticlesTotalCount(state.articles_total);
      setFeaturedTotal(state.featured_articles.length);
      setFeaturedTotalCount(state.featured_articles_total);
      setSavedTotal(state.saved_articles.length);
      setSavedTotalCount(state.saved_articles_total);

      articlesSkipRef.current += state.articles.length;
      featuredSkipRef.current += state.featured_articles.length;
      savedSkipRef.current += state.saved_articles.length;

      initialLoadRef.current = false;
    } catch (error) {
      console.error('Failed to load initial news:', error);
      setLoadError("No se pudo cargar El Quisquilloso. Reviva el santuario y vuelva a intentarlo.");
    } finally {
      setArticlesLoading(false);
      setFeaturedLoading(false);
      setAnnouncementsLoading(false);
      setClassifiedsLoading(false);
      setSavedLoading(false);
      setArticlesLoadingMore(false);
      setFeaturedLoadingMore(false);
      setSavedLoadingMore(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchAll(true);
  }, [fetchAll]);

  const loadMoreArticles = useCallback(async () => {
    if (articlesLoadingMore || !articlesHasMore) return;
    setArticlesLoadingMore(true);
    try {
      const state = await api.getNewsFullState({
        articles_skip: articlesSkipRef.current,
        articles_limit: 9,
        featured_skip: featuredSkipRef.current,
        featured_limit: 9,
        saved_skip: savedSkipRef.current,
        saved_limit: 9,
        announcements_limit: 20,
        classifieds_limit: 20,
      });
      setArticles((prev) => [...prev, ...state.articles]);
      setArticlesHasMore(state.articles_has_more);
      setArticlesTotal((prev) => prev + state.articles.length);
      articlesSkipRef.current += state.articles.length;
    } catch (error) {
      console.error('Failed to load more articles:', error);
    } finally {
      setArticlesLoadingMore(false);
    }
  }, [articlesLoadingMore, articlesHasMore]);

  const loadMoreFeatured = useCallback(async () => {
    if (featuredLoadingMore || !featuredHasMore) return;
    setFeaturedLoadingMore(true);
    try {
      const state = await api.getNewsFullState({
        articles_skip: articlesSkipRef.current,
        articles_limit: 9,
        featured_skip: featuredSkipRef.current,
        featured_limit: 9,
        saved_skip: savedSkipRef.current,
        saved_limit: 9,
        announcements_limit: 20,
        classifieds_limit: 20,
      });
      setFeaturedArticles((prev) => [...prev, ...state.featured_articles]);
      setFeaturedHasMore(state.featured_articles_has_more);
      setFeaturedTotal((prev) => prev + state.featured_articles.length);
      featuredSkipRef.current += state.featured_articles.length;
    } catch (error) {
      console.error('Failed to load more featured articles:', error);
    } finally {
      setFeaturedLoadingMore(false);
    }
  }, [featuredLoadingMore, featuredHasMore]);

  const loadMoreSaved = useCallback(async () => {
    if (savedLoadingMore || !savedHasMore) return;
    setSavedLoadingMore(true);
    try {
      const state = await api.getNewsFullState({
        articles_skip: articlesSkipRef.current,
        articles_limit: 9,
        featured_skip: featuredSkipRef.current,
        featured_limit: 9,
        saved_skip: savedSkipRef.current,
        saved_limit: 9,
        announcements_limit: 20,
        classifieds_limit: 20,
      });
      setSavedArticles((prev) => [...prev, ...state.saved_articles]);
      setSavedHasMore(state.saved_articles_has_more);
      setSavedTotal((prev) => prev + state.saved_articles.length);
      savedSkipRef.current += state.saved_articles.length;
    } catch (error) {
      console.error('Failed to load more saved articles:', error);
    } finally {
      setSavedLoadingMore(false);
    }
  }, [savedLoadingMore, savedHasMore]);

  const refreshArticles = useCallback(async () => {
    articlesSkipRef.current = 0;
    const state = await api.getNewsFullState({
      articles_skip: 0,
      articles_limit: 9,
      featured_skip: featuredSkipRef.current,
      featured_limit: 9,
      saved_skip: savedSkipRef.current,
      saved_limit: 9,
      announcements_limit: 20,
      classifieds_limit: 20,
    });
    setArticles(state.articles);
    setArticlesHasMore(state.articles_has_more);
    setArticlesTotal(state.articles.length);
    setArticlesTotalCount(state.articles_total);
    articlesSkipRef.current = state.articles.length;
  }, []);

  const refreshFeatured = useCallback(async () => {
    featuredSkipRef.current = 0;
    const state = await api.getNewsFullState({
      articles_skip: articlesSkipRef.current,
      articles_limit: 9,
      featured_skip: 0,
      featured_limit: 9,
      saved_skip: savedSkipRef.current,
      saved_limit: 9,
      announcements_limit: 20,
      classifieds_limit: 20,
    });
    setFeaturedArticles(state.featured_articles);
    setFeaturedHasMore(state.featured_articles_has_more);
    setFeaturedTotal(state.featured_articles.length);
    setFeaturedTotalCount(state.featured_articles_total);
    featuredSkipRef.current = state.featured_articles.length;
  }, []);

  const refreshSaved = useCallback(async () => {
    savedSkipRef.current = 0;
    const state = await api.getNewsFullState({
      articles_skip: articlesSkipRef.current,
      articles_limit: 9,
      featured_skip: featuredSkipRef.current,
      featured_limit: 9,
      saved_skip: 0,
      saved_limit: 9,
      announcements_limit: 20,
      classifieds_limit: 20,
    });
    setSavedArticles(state.saved_articles);
    setSavedHasMore(state.saved_articles_has_more);
    setSavedTotal(state.saved_articles.length);
    setSavedTotalCount(state.saved_articles_total);
    savedSkipRef.current = state.saved_articles.length;
  }, []);

  const retry = useCallback(() => {
    fetchAll(true);
  }, [fetchAll]);

  const loading = articlesLoading || announcementsLoading || classifiedsLoading || savedLoading;

  return {
    articles,
    featuredArticles,
    articlesHasMore,
    articlesLoading,
    articlesLoadingMore,
    articlesTotal,
    articlesTotalCount,
    loadMoreArticles,
    refreshArticles,
    featuredHasMore,
    featuredLoading,
    featuredLoadingMore,
    featuredTotal,
    featuredTotalCount,
    loadMoreFeatured,
    refreshFeatured,
    announcements,
    announcementsLoading,
    classifieds,
    classifiedsLoading,
    savedArticles,
    savedHasMore,
    savedLoading,
    savedLoadingMore,
    savedTotal,
    savedTotalCount,
    loadMoreSaved,
    refreshSaved,
    loading,
    loadError,
    retry,
  };
}
"use client";

import { useCallback, useState } from "react";
import { api, Article } from "@/lib/api";
import { toastError } from "@/lib/toastStore";

interface UseArticleActionsOptions {
  authUser: { id: string } | null;
  articles: Article[];
  featuredArticles: Article[];
  filter: "recent" | "featured";
  activeTab: string;
  refreshArticles: () => Promise<void>;
  refreshFeatured: () => Promise<void>;
  refreshSaved: () => Promise<void>;
  onThreadCreated: () => void;
  onThreadDeleted: () => void;
}

export function useArticleActions(options: UseArticleActionsOptions) {
  const {
    authUser,
    articles,
    featuredArticles,
    filter,
    activeTab,
    refreshArticles,
    refreshFeatured,
    refreshSaved,
    onThreadCreated,
    onThreadDeleted,
  } = options;

  const [votedThread, setVotedThread] = useState<string | null>(null);

  const vote = useCallback(
    (threadId: string) => {
      if (!authUser) return;
      setVotedThread(threadId);
    },
    [authUser]
  );

  const createThread = useCallback(
    async (data: { title: string; body: string; category: string }) => {
      if (!authUser) return;
      try {
        await api.createThread(data);
        onThreadCreated();
      } catch (error) {
        toastError("No se pudo crear el hilo", error);
      }
    },
    [authUser, onThreadCreated]
  );

  const deleteThread = useCallback(
    () => {
      if (!authUser) return;
      onThreadDeleted();
    },
    [authUser, onThreadDeleted]
  );

  const toggleSubscribe = useCallback(
    async (articleId: string) => {
      if (!authUser) return;
      try {
        const article =
          articles.find((a) => a.id === articleId) ??
          featuredArticles.find((a) => a.id === articleId);
        if (!article) return;
        if (article.subscribed) {
          await api.unsubscribeArticle(articleId);
        } else {
          await api.subscribeArticle(articleId);
        }
        // Only refresh the active list(s) to avoid unnecessary refetches
        refreshArticles();
        if (filter === "featured") {
          refreshFeatured();
        }
        if (activeTab === "saved") {
          refreshSaved();
        }
      } catch (e) {
        toastError("No se pudo cambiar la suscripción", e);
      }
    },
    [
      authUser,
      articles,
      featuredArticles,
      filter,
      activeTab,
      refreshArticles,
      refreshFeatured,
      refreshSaved,
    ]
  );

  return { votedThread, vote, createThread, deleteThread, toggleSubscribe };
}

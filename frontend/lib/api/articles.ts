import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";
import type { User } from "./users";
import { refreshUserLevelThrottled } from "../levelUp";

export interface Article {
  id: string;
  title: string;
  body: string;
  author_id: string;
  author?: User;
  category: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  video_duration?: number;
  featured: boolean;
  pinned?: boolean;
  created_at: string;
  subscribed?: boolean;
}

export interface ArticleSubscription {
  id: string;
  user_id: string;
  article_id: string;
  created_at: string;
}

export interface ArticleComment {
  id: string;
  article_id: string;
  user_id: string;
  body: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  video_duration?: number;
  parent_id?: string | null;
  replies?: ArticleComment[];
  created_at: string;
  author?: User;
}

export interface Announcement {
  id: string;
  body: string;
  created_at: string;
}

export interface Classified {
  id: string;
  title: string;
  price: string;
  created_at: string;
}

export interface NewsFullState {
  articles: Article[];
  articles_total: number;
  articles_skip: number;
  articles_limit: number;
  articles_has_more: boolean;
  featured_articles: Article[];
  featured_articles_total: number;
  featured_articles_skip: number;
  featured_articles_limit: number;
  featured_articles_has_more: boolean;
  announcements: Announcement[];
  classifieds: Classified[];
  saved_articles: Article[];
  saved_articles_total: number;
  saved_articles_skip: number;
  saved_articles_limit: number;
  saved_articles_has_more: boolean;
}

export const articlesApi = {
  getArticles: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params);
    return request<Page<Article>>(`/articles/?${searchParams.toString()}`);
  },

  getArticleCategories: () => request<string[]>("/articles/categories"),

  getArticle: (id: string) => request<Article>(`/articles/${id}`),

  createArticle: (data: Partial<Article>) =>
    request<Article>("/admin/articles/", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  updateArticle: (id: string, data: Partial<Article>) =>
    request<Article>(`/admin/articles/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteArticle: (id: string) =>
    request<void>(`/admin/articles/${id}`, { method: "DELETE" }),

  subscribeArticle: (id: string) =>
    request<ArticleSubscription>(`/articles/${id}/subscribe`, {
      method: "POST",
    }),

  unsubscribeArticle: (id: string) =>
    request<void>(`/articles/${id}/subscribe`, { method: "DELETE" }),

  getMySubscriptions: () => request<Article[]>("/articles/my/subscriptions"),

  getNewsFullState: (
    params?: {
      articles_skip?: number;
      articles_limit?: number;
      featured_skip?: number;
      featured_limit?: number;
      saved_skip?: number;
      saved_limit?: number;
      announcements_limit?: number;
      classifieds_limit?: number;
    }
  ) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.set(key, String(value));
        }
      });
    }
    return request<NewsFullState>(
      `/articles/full-state?${searchParams.toString()}`
    );
  },

  getArticleComments: (articleId: string) =>
    request<ArticleComment[]>(`/articles/${articleId}/comments`),

  createArticleComment: (
    articleId: string,
    body: string,
    parentId?: string,
    image_url?: string,
    video_url?: string,
    video_poster_url?: string,
    video_duration?: number
  ) =>
    request<ArticleComment>(`/articles/${articleId}/comments`, {
      method: "POST",
      body: JSON.stringify({
        body,
        parent_id: parentId ?? null,
        image_url,
        video_url,
        video_poster_url,
        video_duration,
      }),
    }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  getAnnouncements: (pagination?: PaginationParams) =>
    request<Page<Announcement>>(
      "/announcements/" + buildQuery(pagination ?? {})
    ),

  createAnnouncement: (data: Partial<Announcement>) =>
    request<Announcement>("/admin/announcements/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateAnnouncement: (id: string, data: Partial<Announcement>) =>
    request<Announcement>(`/admin/announcements/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteAnnouncement: (id: string) =>
    request<void>(`/admin/announcements/${id}`, { method: "DELETE" }),

  getClassifieds: (pagination?: PaginationParams) =>
    request<Page<Classified>>(
      "/classifieds/" + buildQuery(pagination ?? {})
    ),

  createClassified: (data: Partial<Classified>) =>
    request<Classified>("/admin/classifieds/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateClassified: (id: string, data: Partial<Classified>) =>
    request<Classified>(`/admin/classifieds/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteClassified: (id: string) =>
    request<void>(`/admin/classifieds/${id}`, { method: "DELETE" }),
};
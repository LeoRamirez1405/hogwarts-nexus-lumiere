import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";
import type { User } from "./users";
import { refreshUserLevelThrottled } from "../levelUp";

export interface ForumThread {
  id: string;
  author_id: string;
  author?: User;
  title: string;
  body: string;
  category: string;
  created_at: string;
  vote_count: number;
  my_vote: number;
  comment_count: number;
  subscribed: boolean;
}

export interface ForumComment {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  parent_id?: string | null;
  replies?: ForumComment[];
  created_at: string;
  author?: User;
}

export const forumApi = {
  getThreads: (pagination?: PaginationParams) =>
    request<Page<ForumThread>>("/forum/" + buildQuery(pagination ?? {})),

  getThread: (id: string) => request<ForumThread>(`/forum/${id}`),

  createThread: (data: {
    title: string;
    body: string;
    category: string;
  }) => {
    refreshUserLevelThrottled();
    return request<ForumThread>("/forum/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  voteThread: (id: string, value: 1 | -1) => {
    refreshUserLevelThrottled();
    return request<ForumThread>(`/forum/${id}/vote`, {
      method: "POST",
      body: JSON.stringify({ value }),
    });
  },

  getThreadComments: (id: string) =>
    request<ForumComment[]>(`/forum/${id}/comments`),

  createThreadComment: (id: string, body: string, parentId?: string) => {
    refreshUserLevelThrottled();
    return request<ForumComment>(`/forum/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parent_id: parentId ?? null }),
    });
  },

  subscribeThread: (id: string) => {
    refreshUserLevelThrottled();
    return request<{ subscribed: boolean }>(`/forum/${id}/subscribe`, {
      method: "POST",
    });
  },

  unsubscribeThread: (id: string) =>
    request<void>(`/forum/${id}/subscribe`, { method: "DELETE" }),

  deleteThread: (id: string) =>
    request<void>(`/forum/${id}`, { method: "DELETE" }),
};
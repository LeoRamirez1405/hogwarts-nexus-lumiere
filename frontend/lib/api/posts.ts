import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";
import type { User } from "./users";
import { refreshUserLevelThrottled } from "../levelUp";

export interface Post {
  id: string;
  author_id: string;
  author?: User;
  body: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  video_duration?: number;
  likes_count?: number;
  liked_by_me?: boolean;
  reposts_count?: number;
  reposted_by_me?: boolean;
  comments_count?: number;
  is_repost?: boolean;
  reposted_by?: User;
  reposted_at?: string;
  edited_at?: string | null;
  edited_by?: User | null;
  created_at: string;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  author?: User;
  body: string;
  parent_id?: string | null;
  replies?: PostComment[];
  created_at: string;
}

export interface PostInput {
  body?: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  video_duration?: number;
}

export const postsApi = {
  getPosts: (pagination?: PaginationParams) =>
    request<Page<Post>>("/posts/" + buildQuery(pagination ?? {})),

  getProfileFeed: (userId: string, pagination?: PaginationParams) =>
    request<Page<Post>>(
      `/posts/user/${userId}` + buildQuery(pagination ?? {})
    ),

  createPost: (data: PostInput) =>
    request<Post>("/posts/", {
      method: "POST",
      body: JSON.stringify(data),
    }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  updatePost: (id: string, data: PostInput) =>
    request<Post>(`/posts/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deletePost: (id: string) =>
    request<void>(`/posts/${id}`, { method: "DELETE" }),

  likePost: (id: string) =>
    request<Post>(`/posts/${id}/like`, { method: "POST" }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  repostPost: (id: string) =>
    request<Post>(`/posts/${id}/repost`, { method: "POST" }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  getComments: (postId: string) =>
    request<PostComment[]>(`/posts/${postId}/comments`),

  addComment: (postId: string, body: string, parentId?: string) =>
    request<PostComment>(`/posts/${postId}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parent_id: parentId ?? null }),
    }).then((res) => {
      refreshUserLevelThrottled(0);
      return res;
    }),

  getPost: (postId: string) =>
    request<Post>(`/posts/${postId}`),
};
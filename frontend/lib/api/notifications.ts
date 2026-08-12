import { request } from "./core";
import type { User } from "./users";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  related_id?: string;
  actor_id?: string;
  actor?: User;
  read: boolean;
  created_at: string;
}

export interface NotificationPage {
  items: Notification[];
  has_more: boolean;
}

export const notificationsApi = {
  getNotifications: (opts?: { limit?: number; cursor?: string }) => {
    const params = new URLSearchParams();
    if (opts?.limit) params.set("limit", String(opts.limit));
    if (opts?.cursor) params.set("cursor", opts.cursor);
    const qs = params.toString();
    return request<NotificationPage>(`/notifications/${qs ? `?${qs}` : ""}`);
  },

  getUnreadNotificationCount: () =>
    request<{ count: number }>("/notifications/unread-count"),

  markNotificationRead: (id: string) =>
    request<Notification>(`/notifications/${id}/read`, { method: "PUT" }),

  markAllNotificationsRead: () =>
    request<void>("/notifications/read-all", { method: "PUT" }),

  markNotificationsRead: (ids: string[]) =>
    request<{ updated: number }>("/notifications/read-batch", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  markNotificationsReadByReference: (ref: {
    types?: string[];
    relatedId?: string;
    relatedPrefix?: string;
  }) =>
    request<{ updated: number }>("/notifications/read-by-reference", {
      method: "POST",
      body: JSON.stringify({
        types: ref.types,
        related_id: ref.relatedId,
        related_prefix: ref.relatedPrefix,
      }),
    }),
};
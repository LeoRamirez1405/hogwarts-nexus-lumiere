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

export const notificationsApi = {
  getNotifications: () => request<Notification[]>("/notifications/"),

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
};
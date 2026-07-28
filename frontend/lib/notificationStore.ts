import { create } from "zustand";
import { api, Notification } from "./api";

interface NotificationState {
  notifications: Notification[];
  loaded: boolean;
  loading: boolean;
  /** Fetch the latest notifications (last 100) and replace local state. */
  load: () => Promise<void>;
  /** Mark a single notification read (backend + local). */
  markRead: (id: string) => Promise<void>;
  /** Mark every unread notification read (backend + local). */
  markAllRead: () => Promise<void>;
  /**
   * Mark read every currently-loaded unread notification matching `predicate`.
   * Used to auto-clear notifications when the user reaches the place they point
   * to. No-ops (no network call) when nothing matches, so it is cheap to call
   * on every route change.
   */
  markReadMatching: (predicate: (n: Notification) => boolean) => Promise<void>;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  loaded: false,
  loading: false,

  load: async () => {
    set({ loading: true });
    try {
      const notifications = await api.getNotifications();
      set({ notifications, loaded: true });
    } catch {
      /* keep previous state on failure */
    } finally {
      set({ loading: false });
    }
  },

  markRead: async (id) => {
    const { notifications } = get();
    if (!notifications.some((n) => n.id === id && !n.read)) return;
    set({
      notifications: notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    });
    try {
      await api.markNotificationsRead([id]);
    } catch {
      /* optimistic update stays; next load() reconciles */
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    if (!notifications.some((n) => !n.read)) return;
    set({ notifications: notifications.map((n) => ({ ...n, read: true })) });
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* optimistic update stays; next load() reconciles */
    }
  },

  markReadMatching: async (predicate) => {
    const { notifications } = get();
    const matchIds = notifications
      .filter((n) => !n.read && predicate(n))
      .map((n) => n.id);
    if (matchIds.length === 0) return;
    const matchSet = new Set(matchIds);
    set({
      notifications: notifications.map((n) =>
        matchSet.has(n.id) ? { ...n, read: true } : n
      ),
    });
    try {
      await api.markNotificationsRead(matchIds);
    } catch {
      /* optimistic update stays; next load() reconciles */
    }
  },
}));

import { create } from "zustand";
import { api, Notification } from "./api";
import { toastError } from "./toastStore";

interface NotificationState {
  notifications: Notification[];
  loaded: boolean;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  /** Fetch the first page (newest 50) and replace local state. */
  load: () => Promise<void>;
  /** Append the next page using the last loaded item as the cursor. */
  loadMore: () => Promise<void>;
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
  loadingMore: false,
  hasMore: false,

  load: async () => {
    set({ loading: true });
    try {
      const page = await api.getNotifications({ limit: 50 });
      set({ notifications: page.items, hasMore: page.has_more, loaded: true });
    } catch (e) {
      toastError("No se pudieron cargar las notificaciones", e);
    } finally {
      set({ loading: false });
    }
  },

  loadMore: async () => {
    const { loading, loadingMore, hasMore, notifications } = get();
    if (loading || loadingMore || !hasMore || notifications.length === 0) return;
    const last = notifications[notifications.length - 1];
    const cursor = `${last.created_at}:${last.id}`;
    set({ loadingMore: true });
    try {
      const page = await api.getNotifications({ limit: 50, cursor });
      set((s) => ({
        notifications: [
          ...s.notifications,
          // Dedupe by id: a new notification arriving between pages would
          // otherwise shift the cursor window and duplicate items.
          ...page.items.filter((n) => !s.notifications.some((x) => x.id === n.id)),
        ],
        hasMore: page.has_more,
      }));
    } catch (e) {
      toastError("No se pudieron cargar más notificaciones", e);
    } finally {
      set({ loadingMore: false });
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
    } catch (e) {
      /* optimistic update stays; next load() reconciles */
      toastError("No se pudo marcar la notificación como leída", e);
    }
  },

  markAllRead: async () => {
    const { notifications } = get();
    if (!notifications.some((n) => !n.read)) return;
    set({ notifications: notifications.map((n) => ({ ...n, read: true })) });
    try {
      await api.markAllNotificationsRead();
    } catch (e) {
      /* optimistic update stays; next load() reconciles */
      toastError("No se pudo marcar todo como leído", e);
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
    } catch (e) {
      /* optimistic update stays; next load() reconciles */
      console.error("No se pudo marcar notificaciones como leídas", e);
    }
  },
}));

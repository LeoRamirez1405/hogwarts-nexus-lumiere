import { create } from "zustand";
import { api, Notification } from "./api";
import { toastError } from "./toastStore";

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
    } catch (e) {
      toastError("No se pudieron cargar las notificaciones", e);
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

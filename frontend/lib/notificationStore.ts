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
  /** Prepend a notification received over WebSocket (dedupes by id). */
  push: (n: Notification) => void;
  /** Mark a single notification read (backend + local). */
  markRead: (id: string) => Promise<void>;
  /** Mark every unread notification read (backend + local). */
  markAllRead: () => Promise<void>;
  /**
   * Mark read every notification whose type + related reference match, both in
   * the loaded list (optimistic) and on the server (so rows the client never
   * loaded also get cleared). Pure REST — works even when the WebSocket is down.
   */
  markReadByReference: (ref: NotificationReadReference) => Promise<void>;
}

export interface NotificationReadReference {
  types?: string[];
  relatedId?: string;
  relatedPrefix?: string;
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

  push: (n) => {
    set((s) => ({
      notifications: [n, ...s.notifications.filter((x) => x.id !== n.id)],
    }));
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

  markReadByReference: async (ref) => {
    const { notifications } = get();
    const matchIds = notifications
      .filter((n) => !n.read && matchesReference(n, ref))
      .map((n) => n.id);
    if (matchIds.length > 0) {
      const matchSet = new Set(matchIds);
      set({
        notifications: notifications.map((n) =>
          matchSet.has(n.id) ? { ...n, read: true } : n
        ),
      });
    }
    try {
      await api.markNotificationsReadByReference(ref);
    } catch (e) {
      /* optimistic update stays; next load() reconciles */
      console.error("No se pudo marcar notificaciones como leídas", e);
    }
  },
}));

function matchesReference(n: Notification, ref: NotificationReadReference): boolean {
  if (ref.types && !ref.types.includes(n.type)) return false;
  if (ref.relatedId !== undefined && n.related_id !== ref.relatedId) return false;
  if (ref.relatedPrefix && !(n.related_id ?? "").startsWith(ref.relatedPrefix)) return false;
  return true;
}

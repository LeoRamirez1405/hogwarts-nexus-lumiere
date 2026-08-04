import type { Notification } from "./api";

export type NotificationCategory =
  | "social"
  | "messages"
  | "press"
  | "forum"
  | "economy"
  | "pets";

export interface NotificationMeta {
  icon: string;
  /** Tailwind classes for the icon chip (bg + text). */
  chip: string;
  category: NotificationCategory;
  /** Destination route for this notification, or null if not navigable. */
  route: (n: Notification) => string | null;
}

const DEFAULT: NotificationMeta = {
  icon: "notifications",
  chip: "bg-surface-container-high text-on-surface-variant",
  category: "social",
  route: () => null,
};

const META: Record<string, NotificationMeta> = {
  // Social / posts → the recipient's own profile feed
  post_like: {
    icon: "favorite",
    chip: "bg-error/10 text-error",
    category: "social",
    route: () => "/profile",
  },
  post_comment: {
    icon: "chat_bubble",
    chip: "bg-primary/10 text-primary",
    category: "social",
    route: () => "/profile",
  },
  post_repost: {
    icon: "repeat",
    chip: "bg-tertiary/10 text-tertiary",
    category: "social",
    route: () => "/profile",
  },
  post_mention: {
    icon: "alternate_email",
    chip: "bg-secondary/10 text-secondary",
    category: "social",
    route: () => "/profile",
  },
  friend_post: {
    icon: "waving_hand",
    chip: "bg-primary/10 text-primary",
    category: "social",
    route: (n) => (n.actor_id ? `/profile/${n.actor_id}` : "/profile"),
  },
  // Social graph
  friend_request: {
    icon: "person_add",
    chip: "bg-primary/10 text-primary",
    category: "social",
    route: (n) => (n.actor_id ? `/profile/${n.actor_id}` : "/profile"),
  },
  friend_accepted: {
    icon: "how_to_reg",
    chip: "bg-primary/10 text-primary",
    category: "social",
    route: (n) => (n.actor_id ? `/profile/${n.actor_id}` : "/profile"),
  },
  // Messaging
  dm_message: {
    icon: "mail",
    chip: "bg-primary/10 text-primary",
    category: "messages",
    route: (n) => (n.related_id ? `/messages?dm=${n.related_id}` : "/messages"),
  },
  mention: {
    icon: "alternate_email",
    chip: "bg-secondary/10 text-secondary",
    category: "messages",
    route: (n) => {
      if (!n.related_id) return "/messages";
      const [roomId, msgId] = n.related_id.split(":");
      return roomId && msgId
        ? `/messages?room=${roomId}&msg=${msgId}`
        : "/messages";
    },
  },
  group_added: {
    icon: "group_add",
    chip: "bg-tertiary/10 text-tertiary",
    category: "messages",
    route: (n) => (n.related_id ? `/messages?room=${n.related_id}` : "/messages"),
  },
  group_event: {
    icon: "event",
    chip: "bg-tertiary/10 text-tertiary",
    category: "messages",
    route: () => "/messages",
  },
  // Press / articles
  article_created: {
    icon: "newspaper",
    chip: "bg-secondary/10 text-secondary",
    category: "press",
    route: (n) => (n.related_id ? `/news/${n.related_id}` : "/news"),
  },
  article_updated: {
    icon: "edit_document",
    chip: "bg-secondary/10 text-secondary",
    category: "press",
    route: (n) => (n.related_id ? `/news/${n.related_id}` : "/news"),
  },
  article_comment: {
    icon: "comment",
    chip: "bg-secondary/10 text-secondary",
    category: "press",
    route: (n) => (n.related_id ? `/news/${n.related_id}` : "/news"),
  },
  announcement: {
    icon: "campaign",
    chip: "bg-tertiary/10 text-tertiary",
    category: "press",
    route: () => "/news",
  },
  // Forum
  forum_reply: {
    icon: "forum",
    chip: "bg-secondary/10 text-secondary",
    category: "forum",
    route: (n) => (n.related_id ? `/news/thread/${n.related_id}` : "/news"),
  },
  forum_mention: {
    icon: "alternate_email",
    chip: "bg-secondary/10 text-secondary",
    category: "forum",
    route: (n) => (n.related_id ? `/news/thread/${n.related_id}` : "/news"),
  },
  // Economy
  zerines_received: {
    icon: "diamond",
    chip: "bg-secondary/10 text-secondary",
    category: "economy",
    route: () => "/treasury",
  },
  // Pets
  pet_needs_attention: {
    icon: "pets",
    chip: "bg-error/10 text-error",
    category: "pets",
    route: () => "/pets",
  },
  pet_aging: {
    icon: "hourglass_bottom",
    chip: "bg-tertiary/10 text-tertiary",
    category: "pets",
    route: () => "/pets",
  },
  pet_farewell: {
    icon: "spa",
    chip: "bg-tertiary/10 text-tertiary",
    category: "pets",
    route: () => "/pets",
  },
  pet_sold: {
    icon: "sell",
    chip: "bg-secondary/10 text-secondary",
    category: "pets",
    route: () => "/pets",
  },
};

export function notificationMeta(type: string): NotificationMeta {
  return META[type] ?? DEFAULT;
}

/**
 * Auto-clear rule: does simply *being* at `pathname` count as attending this
 * notification? True when the notification's own destination matches the
 * current path. Messages are excluded on purpose — a DM/room notification is
 * cleared by opening that specific conversation (handled in the messages page),
 * not by merely landing on `/messages`, which would wipe unrelated chats.
 */
export function autoClearedByPath(n: Notification, pathname: string): boolean {
  const meta = notificationMeta(n.type);
  if (meta.category === "messages") return false;
  const dest = meta.route(n);
  if (!dest) return false;
  const destPath = dest.split("?")[0];
  return destPath === pathname;
}

export const NOTIFICATION_CATEGORIES: {
  key: NotificationCategory | "all";
  label: string;
}[] = [
  { key: "all", label: "Todas" },
  { key: "social", label: "Social" },
  { key: "messages", label: "Mensajes" },
  { key: "press", label: "Prensa" },
  { key: "forum", label: "Foro" },
  { key: "economy", label: "Economía" },
  { key: "pets", label: "Mascotas" },
];

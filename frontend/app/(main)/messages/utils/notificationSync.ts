"use client";

import type { SelectedConvType } from "../types";

interface Notification {
  related_id?: string;
}

export function markNotifsReadMatching(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  markRead: (predicate: (n: Notification) => boolean) => Promise<void>,
  // notifications kept for API compatibility; predicate is self-contained
  notifications: Notification[]
): void {
  if (!selectedId || !selectedType) return;
  if (notifications.length === 0) return;
  void markRead((n) =>
    n.related_id?.startsWith(`conversation:${selectedId}`) === true ||
    n.related_id?.startsWith(`message:${selectedId}`) === true
  );
}
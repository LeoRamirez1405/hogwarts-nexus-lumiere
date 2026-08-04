"use client";

import type { SelectedConvType } from "../types";

interface Notification {
  related_id?: string;
}

export function markNotifsReadMatching(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  markRead: (filter: { conversationId: string; conversationType: string }) => void,
  notifications: Notification[]
): void {
  if (!selectedId || !selectedType) return;
  const matching = notifications.filter(
    (n) =>
      n.related_id?.startsWith(`conversation:${selectedId}`) ||
      (n.related_id?.startsWith(`message:`) && selectedId)
  );
  if (matching.length > 0) {
    markRead({ conversationId: selectedId, conversationType: selectedType });
  }
}
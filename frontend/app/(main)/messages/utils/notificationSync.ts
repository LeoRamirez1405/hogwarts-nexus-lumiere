"use client";

import type { SelectedConvType } from "../types";

/**
 * Mark message notifications read when the user opens their conversation.
 *
 * Backend formats for `related_id`:
 * - dm_message: the partner's user id (== selectedId for DMs)
 * - mention (room): "{room_id}:{message_id}" (starts with the room id)
 * - group_added / group_join_request: the room id
 *
 * Uses `markReadByReference` (REST) so rows that were never loaded client-side
 * also get cleared, and it works when the WebSocket is down.
 */
export function markNotifsReadMatching(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  markRead: (ref: {
    types?: string[];
    relatedId?: string;
    relatedPrefix?: string;
  }) => Promise<void>
): void {
  if (!selectedId || !selectedType) return;
  if (selectedType === "direct") {
    void markRead({ types: ["dm_message"], relatedId: selectedId });
  } else {
    void markRead({
      types: ["mention", "group_added", "group_join_request"],
      relatedPrefix: selectedId,
    });
  }
}

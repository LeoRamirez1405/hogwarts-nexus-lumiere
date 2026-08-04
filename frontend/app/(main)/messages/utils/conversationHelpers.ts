"use client";

import type { Conversation, User } from "@/lib/api";
import type { SelectedConvType } from "../types";

export function buildSelectedConv(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  conversations: Conversation[],
  allUsers: User[]
): Conversation | null {
  if (!selectedId || !selectedType) return null;

  if (selectedType === "room") {
    return conversations.find((c) => c.id === selectedId) ?? null;
  }

  const conv = conversations.find((c) => c.id === selectedId);
  if (conv) return conv;

  const user = allUsers.find((u) => u.id === selectedId);
  if (user) {
    return {
      id: user.id,
      name: user.name,
      type: "direct" as const,
      avatar_url: user.avatar_url,
      is_pinned: false,
      is_archived: false,
      is_hidden: false,
      unread_count: 0,
    };
  }

  return null;
}

interface ApiClient {
  getConversations: () => Promise<Conversation[]>;
}

export function selectConv(
  id: string,
  type: SelectedConvType,
  setSelectedId: (id: string | null) => void,
  setSelectedType: (type: SelectedConvType | null) => void,
  setTargetMessageId: (id: string | null) => void,
  conversations: Conversation[],
  setConversations: (convs: Conversation[]) => void,
  api: ApiClient
): void {
  setTargetMessageId(null);
  setSelectedId(id);
  setSelectedType(type);
  if (!conversations.some((c) => c.id === id)) {
    api.getConversations().then((convs: Conversation[]) => setConversations(convs)).catch(() => {});
  }
}
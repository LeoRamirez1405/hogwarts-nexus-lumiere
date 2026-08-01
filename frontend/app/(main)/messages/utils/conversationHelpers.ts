import { Conversation, User } from "@/lib/api";
import { SelectedConv, SelectedConvType } from "../types";

export function selectConversation(
  id: string,
  type: SelectedConvType,
  setSelectedId: (id: string | null) => void,
  setSelectedType: (type: SelectedConvType | null) => void,
  setTargetMessageId: (id: string | null) => void,
  conversations: Conversation[],
  setConversations: (convs: Conversation[]) => void,
  getConversations: () => Promise<Conversation[]>
) {
  setTargetMessageId(null);
  setSelectedId(id);
  setSelectedType(type);
  if (!conversations.some((c) => c.id === id)) {
    getConversations().then(setConversations).catch(() => {});
  }
}

export function buildSelectedConv(
  selectedId: string | null,
  selectedType: SelectedConvType | null,
  conversations: Conversation[],
  allUsers: User[]
): SelectedConv | null {
  const selectedConversation = conversations.find((c) => c.id === selectedId);
  if (selectedConversation) {
    return {
      id: selectedConversation.id,
      name: selectedConversation.name,
      avatar_url: selectedConversation.avatar_url,
      type: selectedConversation.type,
      last_active_at: selectedConversation.last_active_at,
      online_count: selectedConversation.online_count,
    };
  }
  if (selectedId && selectedType === "direct") {
    const u = allUsers.find((x) => x.id === selectedId);
    return {
      id: selectedId,
      name: u?.name ?? "",
      avatar_url: u?.avatar_url,
      type: "direct",
      last_active_at: u?.last_active_at,
    };
  }
  if (selectedId && selectedType) {
    return { id: selectedId, name: "", type: selectedType };
  }
  return null;
}
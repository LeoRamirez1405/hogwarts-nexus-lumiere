"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Conversation, User } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

export function useConversations(authUser: { id: string } | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    Promise.all([api.getConversations(), api.getUsers()])
      .then(([convs, users]) => {
        setConversations(convs);
        setAllUsers(users.items.filter((u) => u.id !== authUser.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  const refreshConversations = useCallback(() => {
    api.getConversations().then(setConversations).catch(() => {});
  }, []);

  const filtered = debouncedSearch
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(debouncedSearch.toLowerCase())
      )
    : conversations;

  return {
    conversations,
    setConversations,
    allUsers,
    search,
    setSearch,
    debouncedSearch,
    loading,
    filtered,
    refreshConversations,
  };
}
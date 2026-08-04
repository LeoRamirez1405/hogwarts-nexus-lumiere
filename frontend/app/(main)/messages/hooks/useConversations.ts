"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Conversation, User } from "@/lib/api";

export function useConversations(authUser: { id: string } | null) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    if (!authUser) return;
    try {
      const convs = await api.getConversations();
      setConversations(convs);
    } catch (error) {
      console.error("Failed to load conversations:", error);
    }
  }, [authUser]);

  const loadAllUsers = useCallback(async () => {
    if (!authUser) return;
    try {
      const users = await api.searchUsersServer("", { limit: 100 });
      setAllUsers(users.items.filter((u) => u.id !== authUser.id));
    } catch {
      // Silent fail
    }
  }, [authUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await loadConversations();
      await loadAllUsers();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadConversations, loadAllUsers]);

  const refreshConversations = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    setConversations,
    allUsers,
    setAllUsers,
    loading,
    refreshConversations,
  };
}
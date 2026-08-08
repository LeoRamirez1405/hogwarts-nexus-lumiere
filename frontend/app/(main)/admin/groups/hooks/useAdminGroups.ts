"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, ChatRoomBrief, User, Page } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import { toastError } from "@/lib/toastStore";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const defaultCreateForm: {
  name: string;
  description: string;
  type: "group";
  member_ids: string[];
  avatar_url: string;
} = {
  name: "",
  description: "",
  type: "group",
  member_ids: [],
  avatar_url: "",
};

export function useAdminGroups() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allUsersMap, setAllUsersMap] = useState<Record<string, User>>({});
  const [usersPage, setUsersPage] = useState<Page<User> | null>(null);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);

  const crud = useAdminCrud<ChatRoomBrief, typeof defaultCreateForm, Partial<ChatRoomBrief>>({
    queryKey: ["admin-rooms"],
    fetcher: (p) =>
      api.getRooms(user?.role === "admin" ? true : undefined, p, debouncedSearch || undefined),
    createFn: async (data) => {
      const result = await api.createRoom(data);
      return result as unknown as ChatRoomBrief;
    },
    updateFn: async (id, data) => {
      const result = await api.updateRoom(id, data);
      return result as unknown as ChatRoomBrief;
    },
    deleteFn: (id) => api.deleteRoom(id),
    getDisplayName: (r) => r.name,
    getId: (r) => r.id,
    pageSize: 10,
    enabled: user?.role === "admin",
    resetKey: debouncedSearch,
    defaultCreateForm,
    messages: {
      create: "Grupo creado",
      update: "Grupo actualizado",
      delete: "Grupo eliminado",
    },
  });

  const loadUsers = useCallback(async (q = "", page = 0) => {
    if (page > 0) setUsersLoadingMore(true);
    try {
      const result = await api.searchUsersServer(q, { skip: page * 20, limit: 20 });
      if (page === 0) {
        setAllUsers(result.items);
        setUsersPage(result);
      } else {
        setUsersPage(prev => prev ? {
          ...prev,
          items: [...prev.items, ...result.items],
          has_more: result.has_more,
          skip: result.skip,
        } : result);
        setAllUsers(prev => [...prev, ...result.items]);
      }
      const userMap: Record<string, User> = {};
      result.items.forEach((u) => { userMap[u.id] = u; });
      setAllUsersMap(prev => {
        const next = { ...prev };
        result.items.forEach((u) => { next[u.id] = u; });
        return next;
      });
    } catch (e) {
      toastError("No se pudieron cargar los usuarios", e);
    } finally {
      setUsersLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    const timer = setTimeout(() => { loadUsers(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, router]);

  return {
    crud,
    search,
    setSearch,
    allUsers,
    setAllUsers,
    allUsersMap,
    setAllUsersMap,
    usersPage,
    setUsersPage,
    usersLoadingMore,
    setUsersLoadingMore,
    loadUsers,
    formatDate,
    defaultCreateForm,
  };
}
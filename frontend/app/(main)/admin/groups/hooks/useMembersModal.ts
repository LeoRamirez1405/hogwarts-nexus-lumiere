"use client";

import { useCallback, useState } from "react";
import { api, ChatRoomBrief, ChatRoomMemberResponse, User, Page } from "@/lib/api";
import { toastError } from "@/lib/toastStore";

export function useMembersModal({
  allUsers,
  usersPage,
  usersLoadingMore,
  setUsersPage,
  setAllUsers,
  setAllUsersMap,
  setUsersLoadingMore,
  refreshRooms,
}: {
  allUsers: User[];
  usersPage: Page<User> | null;
  usersLoadingMore: boolean;
  setUsersPage: React.Dispatch<React.SetStateAction<Page<User> | null>>;
  setAllUsers: React.Dispatch<React.SetStateAction<User[]>>;
  setAllUsersMap: React.Dispatch<React.SetStateAction<Record<string, User>>>;
  setUsersLoadingMore: React.Dispatch<React.SetStateAction<boolean>>;
  refreshRooms: () => Promise<void>;
}) {
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [roomMembers, setRoomMembers] = useState<ChatRoomMemberResponse[]>([]);
  const [showMembers, setShowMembers] = useState<string | null>(null);

  const loadUsers = useCallback(
    async (q = "", page = 0) => {
      if (page > 0) setUsersLoadingMore(true);
      try {
        const result = await api.searchUsersServer(q, { skip: page * 20, limit: 20 });
        if (page === 0) {
          setAllUsers(result.items);
          setUsersPage(result);
        } else if (usersPage) {
          const updated = {
            ...usersPage,
            items: [...usersPage.items, ...result.items],
            has_more: result.has_more,
            skip: result.skip,
          };
          setUsersPage(updated);
          setAllUsers(updated.items);
        }
        const userMap: Record<string, User> = {};
        result.items.forEach((u) => { userMap[u.id] = u; });
        if (usersPage && page > 0) {
          usersPage.items.forEach((u) => { userMap[u.id] = u; });
        }
        setAllUsersMap(userMap);
      } catch (e) {
        toastError("No se pudieron cargar los usuarios", e);
      } finally {
        setUsersLoadingMore(false);
      }
    },
    [usersPage, setUsersPage, setAllUsers, setAllUsersMap, setUsersLoadingMore]
  );

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const availableUsers = filteredUsers.filter((u) => !selectedMembers.includes(u.id));

  const loadMoreUsers = useCallback(() => {
    if (usersPage?.has_more && !usersLoadingMore) {
      loadUsers(memberSearch, (usersPage.skip / usersPage.limit) + 1);
    }
  }, [usersPage, usersLoadingMore, loadUsers, memberSearch]);

  const toggleMemberInCreate = useCallback(
    (userId: string, currentIds: string[]) => {
      return currentIds.includes(userId)
        ? currentIds.filter((id) => id !== userId)
        : [...currentIds, userId];
    },
    []
  );

  const openMembers = useCallback(
    async (room: ChatRoomBrief) => {
      setShowMembers(room.id);
      setRoomMembers([]);
      try {
        const fullRoom = await api.getRoom(room.id);
        const members = fullRoom.members || [];
        setRoomMembers(members);
        setSelectedMembers(members.map((m) => m.user_id));
      } catch (e) {
        toastError("No se pudo cargar la información del grupo", e);
        setSelectedMembers([]);
        setRoomMembers([]);
      }
    },
    []
  );

  const handleAddMembers = useCallback(
    async (roomId: string) => {
      // Only send users that are not already members — the batch endpoint
      // rejects the whole request if ANY id already exists.
      const existingIds = new Set(roomMembers.map((m) => m.user_id));
      const newIds = selectedMembers.filter((id) => !existingIds.has(id));
      if (newIds.length === 0) return;
      try {
        await api.addRoomMembersBatch(roomId, newIds);
        setShowMembers(null);
        setSelectedMembers([]);
        setRoomMembers([]);
        setMemberSearch("");
        await refreshRooms();
      } catch (e) {
        toastError("No se pudieron agregar los miembros", e);
      }
    },
    [selectedMembers, roomMembers, refreshRooms]
  );

  const handleRemoveMember = useCallback(
    async (roomId: string, memberId: string) => {
      try {
        await api.removeRoomMember(roomId, memberId);
        setSelectedMembers((prev) => prev.filter((id) => id !== memberId));
        setRoomMembers((prev) => prev.filter((m) => m.user_id !== memberId));
        await refreshRooms();
      } catch (e) {
        toastError("No se pudo quitar el miembro", e);
      }
    },
    [refreshRooms]
  );

  const closeMembers = useCallback(() => {
    setShowMembers(null);
    setSelectedMembers([]);
    setRoomMembers([]);
    setMemberSearch("");
  }, []);

  return {
    memberSearch,
    setMemberSearch,
    selectedMembers,
    setSelectedMembers,
    roomMembers,
    showMembers,
    setShowMembers,
    filteredUsers,
    availableUsers,
    usersLoadingMore,
    loadUsers,
    loadMoreUsers,
    toggleMemberInCreate,
    openMembers,
    handleAddMembers,
    handleRemoveMember,
    closeMembers,
  };
}
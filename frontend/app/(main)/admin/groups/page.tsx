"use client";

import { useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, ChatRoomBrief } from "@/lib/api";
import { toastError, toastSuccess } from "@/lib/toastStore";

import {
  useAdminGroups,
  useGroupActions,
  useMembersModal,
} from "./hooks";
import {
  GroupsHeader,
  GroupsList,
  CreateGroupModal,
  EditGroupModal,
  MembersModal,
} from "./components";
import PullToRefresh from "@/components/ui/PullToRefresh";

type CreateFormData = {
  name: string;
  description: string;
  type: "group";
  member_ids: string[];
  avatar_url: string;
};

const emptyCreateForm: CreateFormData = {
  name: "",
  description: "",
  type: "group",
  member_ids: [],
  avatar_url: "",
};

export default function AdminGroupsPage() {
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormData>(emptyCreateForm);
  const [editForm, setEditForm] = useState<Partial<ChatRoomBrief>>({});
  const createAvatarRef = useRef<HTMLInputElement>(null);
  const editAvatarRef = useRef<HTMLInputElement>(null);

  const {
    crud,
    search,
    setSearch,
    allUsers,
    allUsersMap,
    usersPage,
    usersLoadingMore,
    setUsersPage,
    setAllUsers,
    setAllUsersMap,
    setUsersLoadingMore,
  } = useAdminGroups();

  const { handleCreateRoom, handleUpdateRoom, handleDeleteRoom, handleToggleClose } =
    useGroupActions(crud as unknown as Parameters<typeof useGroupActions>[0], crud.refresh);

  const {
    memberSearch,
    setMemberSearch,
    selectedMembers,
    setSelectedMembers,
    showMembers,
    availableUsers,
    usersLoadingMore: membersLoadingMore,
    loadMoreUsers,
    toggleMemberInCreate,
    openMembers,
    handleAddMembers: handleAddMembersModal,
    closeMembers,
  } = useMembersModal({
    allUsers,
    usersPage,
    usersLoadingMore,
    setUsersPage,
    setAllUsers,
    setAllUsersMap,
    setUsersLoadingMore,
    refreshRooms: crud.refresh,
  });

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, target: "create" | "edit") => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const result = await api.uploadFile(file);
      if (target === "create") {
        setCreateForm((prev) => ({ ...prev, avatar_url: result.url }));
      } else {
        setEditForm((prev) => ({ ...prev, avatar_url: result.url }));
      }
      toastSuccess("Imagen subida");
    } catch (err) {
      toastError("No se pudo subir la imagen", err);
    }
    e.target.value = "";
  };

  const handleCreateSubmit = useCallback(async () => {
    await handleCreateRoom(createForm);
    setShowCreate(false);
    setCreateForm(emptyCreateForm);
  }, [createForm, handleCreateRoom]);

  const handleUpdateSubmit = useCallback(async () => {
    if (!crud.editItem) return;
    await handleUpdateRoom(crud.editItem.id, editForm);
    setShowEdit(null);
    setEditForm({});
  }, [crud.editItem, editForm, handleUpdateRoom]);

  const toggleMemberInCreateWrapper = useCallback(
    (userId: string) => {
      setCreateForm((prev) => ({
        ...prev,
        member_ids: toggleMemberInCreate(userId, prev.member_ids),
      }));
    },
    [toggleMemberInCreate]
  );

  const openEdit = useCallback((room: ChatRoomBrief) => {
    setEditForm({ ...room });
    setShowEdit(room.id);
  }, []);

  const openMembersWrapper = useCallback(
    async (room: ChatRoomBrief) => {
      await openMembers(room);
    },
    [openMembers]
  );

  if (user?.role !== "admin") return null;

  return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <GroupsHeader onCreateClick={() => setShowCreate(true)} />

        <GroupsList
          rooms={crud.filteredItems}
          loading={crud.loading}
          hasMore={crud.hasMore}
          loadingMore={crud.loadingMore}
          totalCount={crud.totalCount}
          totalLoaded={crud.totalLoaded}
          search={search}
          onSearchChange={setSearch}
          onToggleClose={handleToggleClose}
          onEdit={openEdit}
          onMembers={openMembersWrapper}
          onDelete={handleDeleteRoom}
          onLoadMore={crud.loadMore}
        />

        {/* Create Group Modal */}
        <CreateGroupModal
          open={showCreate}
          onClose={() => { setShowCreate(false); setCreateForm(emptyCreateForm); }}
          onSave={handleCreateSubmit}
          saving={crud.creating}
          form={createForm}
          setForm={setCreateForm}
          avatarRef={createAvatarRef}
          onAvatarUpload={(e) => handleAvatarUpload(e, "create")}
          memberSearch={memberSearch}
          setMemberSearch={setMemberSearch}
          availableUsers={availableUsers}
          usersLoadingMore={membersLoadingMore}
          loadMoreUsers={loadMoreUsers}
          toggleMember={toggleMemberInCreateWrapper}
          selectedMemberCount={createForm.member_ids.length}
          usersPage={usersPage}
        />

        {/* Edit Group Modal */}
        <EditGroupModal
          open={!!showEdit}
          onClose={() => { setShowEdit(null); setEditForm({}); }}
          onSave={handleUpdateSubmit}
          saving={crud.saving}
          form={editForm}
          setForm={setEditForm}
          avatarRef={editAvatarRef}
          onAvatarUpload={(e) => handleAvatarUpload(e, "edit")}
        />

        {/* Members Modal */}
        <MembersModal
          open={!!showMembers}
          onClose={closeMembers}
          roomId={showMembers}
          memberSearch={memberSearch}
          setMemberSearch={setMemberSearch}
          selectedMembers={selectedMembers}
          setSelectedMembers={setSelectedMembers}
          availableUsers={availableUsers}
          usersLoadingMore={membersLoadingMore}
          loadMoreUsers={loadMoreUsers}
          onAddMembers={handleAddMembersModal}
          currentMembers={selectedMembers.map((id) => allUsersMap[id]).filter((m): m is NonNullable<typeof m> => Boolean(m))}
          onRemoveMember={(memberId) => setSelectedMembers((prev) => prev.filter((id) => id !== memberId))}
          usersPage={usersPage}
        />
     </div>
    </PullToRefresh>
  );
}
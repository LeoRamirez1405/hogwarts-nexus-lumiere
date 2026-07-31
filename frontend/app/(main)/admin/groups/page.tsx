"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, ChatRoomBrief, User, Page, CreateRoomData, UpdateRoomData } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";
import ListFooter from "@/components/ui/ListFooter";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Image from "next/image";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toastError, toastSuccess } from "@/lib/toastStore";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const defaultCreateForm: CreateRoomData = {
  name: "",
  description: "",
  type: "group",
  member_ids: [],
  avatar_url: "",
};

export default function AdminGroupsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [allUsersMap, setAllUsersMap] = useState<Record<string, User>>({});
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [usersPage, setUsersPage] = useState<Page<User> | null>(null);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const createAvatarRef = useRef<HTMLInputElement>(null);
  const editAvatarRef = useRef<HTMLInputElement>(null);
  const [createForm, setCreateForm] = useState<CreateRoomData>(defaultCreateForm);
  const [editForm, setEditForm] = useState<Partial<ChatRoomBrief>>({});

  const crud = useAdminCrud<ChatRoomBrief, CreateRoomData, UpdateRoomData>({
    queryKey: ["admin-rooms"],
    fetcher: (p) => api.getRooms(user?.role === "admin" ? true : undefined, p),
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
    defaultCreateForm,
    messages: {
      create: "Grupo creado",
      update: "Grupo actualizado",
      delete: "Grupo eliminado",
    },
    filterFn: (r, search) =>
      !search ||
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase()) ||
      false,
  });

  const loadUsers = useCallback(async (q = "", page = 0) => {
    if (page > 0) setUsersLoadingMore(true);
    try {
      const result = await api.searchUsersServer(q, { skip: page * 20, limit: 20 });
      if (page === 0) {
        setAllUsers(result.items);
        setUsersPage(result);
      } else if (usersPage) {
        const updated = { ...usersPage, items: [...usersPage.items, ...result.items], has_more: result.has_more, skip: result.skip };
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
  }, [usersPage]);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    const timer = setTimeout(() => { loadUsers(); }, 0);
    return () => clearTimeout(timer);
  }, [user, router, loadUsers]);

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

  const handleCreateRoom = async () => {
    if (!createForm.name.trim() || createForm.member_ids.length < 2) return;
    await crud.handleCreate(createForm);
    setShowCreate(false);
    setCreateForm(defaultCreateForm);
  };

  const handleUpdateRoom = async () => {
    if (!crud.editItem) return;
    await crud.handleSave(crud.editItem.id, editForm);
    setShowEdit(null);
    setEditForm({});
  };

  const handleDeleteRoom = (roomId: string) => {
    confirmDialog({
      title: "Eliminar grupo?",
      message: "Se borrarán todos sus mensajes. Esta acción no se puede deshacer.",
      variant: "danger",
      icon: "delete",
      onConfirm: () => crud.handleDelete(roomId),
    });
  };

  const handleToggleClose = async (roomId: string) => {
    try {
      const updated = await api.toggleRoomClosed(roomId);
      await crud.refresh();
      toastSuccess(updated.closed ? "Grupo cerrado — solo admins pueden hablar" : "Grupo reabierto");
    } catch (e) {
      toastError("No se pudo cambiar el estado del grupo", e);
    }
  };

  const handleAddMembers = async (roomId: string) => {
    if (selectedMembers.length === 0) return;
    try {
      await api.addRoomMembersBatch(roomId, selectedMembers);
      setShowMembers(null);
      setSelectedMembers([]);
      setMemberSearch("");
      toastSuccess("Miembros agregados");
      await crud.refresh();
    } catch (e) {
      toastError("No se pudieron agregar los miembros", e);
    }
  };

  const toggleMemberInCreate = (userId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      member_ids: prev.member_ids.includes(userId)
        ? prev.member_ids.filter((id) => id !== userId)
        : [...prev.member_ids, userId],
    }));
  };

  const openEdit = (room: ChatRoomBrief) => {
    setEditForm({ ...room });
    setShowEdit(room.id);
  };

  const openMembers = async (room: ChatRoomBrief) => {
    setShowMembers(room.id);
    try {
      const fullRoom = await api.getRoom(room.id);
      setSelectedMembers(fullRoom.members.map((m) => m.user_id));
    } catch (e) {
      toastError("No se pudo cargar la información del grupo", e);
      setSelectedMembers([]);
    }
  };

  const filteredRooms = crud.filteredItems;
  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );
  const availableUsers = filteredUsers.filter((u) => !selectedMembers.includes(u.id));

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const loadMoreUsers = () => {
    if (usersPage?.has_more && !usersLoadingMore) {
      loadUsers(memberSearch, (usersPage.skip / usersPage.limit) + 1);
    }
  };

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Gestion de Grupos
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Crea y administra grupos de chat. Solo administradores.
          </p>
        </div>
        <Button
          variant="primary"
          icon="add"
          iconPosition="left"
          onClick={() => { setCreateForm(defaultCreateForm); setShowCreate(true); }}
        >
          Nuevo Grupo
        </Button>
      </div>

      <div className="glass-card rounded-xl overflow-hidden">
        <div className="p-4 border-b border-outline-variant/20">
          <input
            type="text"
            placeholder="Buscar grupos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
          />
        </div>

        {/* MOBILE: Cards */}
        <div className="md:hidden divide-y divide-outline-variant/10">
          {crud.loading ? (
            <div className="p-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
                <p className="text-on-surface-variant text-body-md">Cargando grupos...</p>
              </div>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="p-12 text-center">
              <MaterialIcon name="groups" className="text-5xl text-outline-variant mb-3 block mx-auto" />
              <p className="text-on-surface-variant text-body-md">
                {search ? "Sin resultados" : "No hay grupos creados aún"}
              </p>
            </div>
          ) : (
            <>
              {filteredRooms.map((room) => (
                <div key={room.id} className="p-4 hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/10 last:border-0">
                  <div className="flex items-start gap-3">
                    <Avatar src={room.avatar_url} alt={room.name} size="sm" initials={getInitials(room.name)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md text-on-surface font-medium truncate">{room.name}</p>
                      {room.description && (
                        <p className="text-label-sm text-on-surface-variant truncate">{room.description}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Badge variant="count">{room.member_count}</Badge>
                        <span className="text-label-sm text-on-surface-variant">miembros</span>
                        {room.closed ? (
                          <Badge variant="tag" color="error">
                            <MaterialIcon name="lock" className="text-xs mr-1" />
                            Cerrado
                          </Badge>
                        ) : (
                          <Badge variant="tag" color="success">
                            <MaterialIcon name="lock_open" className="text-xs mr-1" />
                            Abierto
                          </Badge>
                        )}
                      </div>
                      <p className="text-label-sm text-on-surface-variant mt-1">
                        Creado {formatDate(room.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-3">
                    <button
                      onClick={() => handleToggleClose(room.id)}
                      className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
                        room.closed
                          ? "hover:bg-green-100 text-green-600"
                          : "hover:bg-amber-100 text-amber-600"
                      }`}
                      title={room.closed ? "Reabrir grupo" : "Cerrar grupo"}
                    >
                      <MaterialIcon name={room.closed ? "lock_open" : "lock"} className="text-lg" />
                    </button>
                    <button onClick={() => openEdit(room)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Editar">
                      <MaterialIcon name="edit" className="text-lg" />
                    </button>
                    <button onClick={() => openMembers(room)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Miembros">
                      <MaterialIcon name="group" className="text-lg" />
                    </button>
                    <button onClick={() => handleDeleteRoom(room.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                      <MaterialIcon name="delete" className="text-lg" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="p-2">
                <ListFooter
                  hasMore={crud.hasMore}
                  loading={crud.loadingMore}
                  pageSize={10}
                  loaded={crud.totalLoaded}
                  total={crud.totalCount}
                  onLoadMore={crud.loadMore}
                />
              </div>
            </>
          )}
        </div>

        {/* DESKTOP: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead className="sticky top-0 z-10 bg-surface-container">
              <tr className="border-b border-outline-variant/20">
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">Grupo</th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">Miembros</th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Estado</th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Creador</th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Creado</th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right pr-6">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {crud.loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
                      <p className="text-on-surface-variant text-body-md">Cargando grupos...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <MaterialIcon name="groups" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                    <p className="text-on-surface-variant text-body-md">
                      {search ? "Sin resultados" : "No hay grupos creados aún"}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRooms.map((room) => (
                  <tr key={room.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar src={room.avatar_url} alt={room.name} size="sm" initials={getInitials(room.name)} />
                        <div className="min-w-0">
                          <p className="text-body-md text-on-surface truncate max-w-xs">{room.name}</p>
                          {room.description && (
                            <p className="text-label-sm text-on-surface-variant truncate max-w-xs">{room.description}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <Badge variant="count">{room.member_count}</Badge>
                      <span className="text-label-sm text-on-surface-variant ml-2">miembros</span>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      {room.closed ? (
                        <Badge variant="tag" color="error">
                          <MaterialIcon name="lock" className="text-xs mr-1" />
                          Cerrado
                        </Badge>
                      ) : (
                        <Badge variant="tag" color="success">
                          <MaterialIcon name="lock_open" className="text-xs mr-1" />
                          Abierto
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <p className="text-label-sm text-on-surface-variant">
                        {allUsersMap[room.created_by]?.name || room.created_by.slice(0, 8)}
                      </p>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <p className="text-label-sm text-on-surface-variant">{formatDate(room.created_at)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggleClose(room.id)}
                          className={`p-2 rounded-full transition-colors ${
                            room.closed
                              ? "hover:bg-green-100 text-green-600"
                              : "hover:bg-amber-100 text-amber-600"
                          }`}
                          title={room.closed ? "Reabrir grupo" : "Cerrar grupo"}
                        >
                          <MaterialIcon name={room.closed ? "lock_open" : "lock"} className="text-lg" />
                        </button>
                        <button onClick={() => openEdit(room)} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Editar">
                          <MaterialIcon name="edit" className="text-lg" />
                        </button>
                        <button onClick={() => openMembers(room)} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Miembros">
                          <MaterialIcon name="group" className="text-lg" />
                        </button>
                        <button onClick={() => handleDeleteRoom(room.id)} className="p-2 rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                          <MaterialIcon name="delete" className="text-lg" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="hidden md:block p-4 border-t border-outline-variant/20">
          <ListFooter
            hasMore={crud.hasMore}
            loading={crud.loadingMore}
            pageSize={10}
            loaded={crud.totalLoaded}
            total={crud.totalCount}
            onLoadMore={crud.loadMore}
          />
        </div>
      </div>

      {/* Create Room Modal */}
      {showCreate && (
        <AdminCrudModal
          open
          onClose={() => { setShowCreate(false); setCreateForm(defaultCreateForm); }}
          title="Crear Nuevo Grupo"
          size="md"
          saving={crud.creating}
          onSave={handleCreateRoom}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                ref={createAvatarRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                onChange={(e) => handleAvatarUpload(e, "create")}
              />
              <button
                onClick={() => createAvatarRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-dashed border-outline-variant/40 hover:border-primary/60 transition-colors"
              >
                {createForm.avatar_url ? (
                  <Image
                    src={createForm.avatar_url}
                    alt="Avatar"
                    fill
                    className="object-cover"
                    unoptimized={createForm.avatar_url?.startsWith("http://localhost:8000/uploads/") ?? false}
                  />
                ) : (
                  <MaterialIcon name="add_a_photo" className="text-2xl text-outline-variant" />
                )}
              </button>
              <div>
                <p className="text-body-md text-on-surface font-medium">Foto del grupo</p>
                <p className="text-label-sm text-on-surface-variant">Opcional. Click para subir.</p>
              </div>
            </div>

            <FormField label="Nombre del grupo" required>
              <InputField
                value={createForm.name}
                onChange={(v: string) => setCreateForm((prev) => ({ ...prev, name: v }))}
                placeholder="Ej: Profesores de Hogwarts"
                autoFocus
                firstInput
              />
            </FormField>
            <FormField label="Descripcion">
              <TextareaField
                value={createForm.description || ""}
                onChange={(v: string) => setCreateForm((prev) => ({ ...prev, description: v }))}
                placeholder="Descripcion opcional..."
                rows={3}
              />
            </FormField>

            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">
                Miembros <span className="text-error">(minimo 2)</span>
              </label>
              <div className="relative mb-2">
                <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant" />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Buscar usuarios..."
                  className="w-full bg-surface-container-low rounded-xl pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
                />
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="py-4 text-center text-on-surface-variant text-label-sm">Sin usuarios</p>
                ) : (
                  filteredUsers.map((u) => {
                    const selected = createForm.member_ids.includes(u.id);
                    return (
                      <button
                        key={u.id}
                        onClick={() => toggleMemberInCreate(u.id)}
                        className={`flex items-center gap-3 px-3 py-2 w-full text-left rounded-xl transition-colors ${
                          selected ? "bg-primary/10 border border-primary/30" : "hover:bg-surface-container-high"
                        }`}
                      >
                        <Avatar src={u.avatar_url} alt={u.name} size="sm" initials={getInitials(u.name)} />
                        <div className="flex-1 min-w-0">
                          <p className="text-body-md text-on-surface truncate">{u.name}</p>
                        </div>
                        <MaterialIcon
                          name={selected ? "check_circle" : "add_circle"}
                          className={selected ? "text-primary text-xl" : "text-on-surface-variant text-xl"}
                        />
                      </button>
                    );
                  })
                )}
              </div>
              {(usersPage?.has_more || (filteredUsers.length === allUsers.length && allUsers.length > 0)) && (
                <div className="pt-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreUsers}
                    disabled={usersLoadingMore}
                  >
                    {usersLoadingMore ? "Cargando..." : "Cargar más usuarios"}
                  </Button>
                </div>
              )}
              {createForm.member_ids.length > 0 && (
                <p className="text-label-sm text-primary mt-2">
                  {createForm.member_ids.length} seleccionado(s)
                </p>
              )}
            </div>

            <div className="flex gap-4 pt-4 justify-end">
              <Button
                variant="primary"
                onClick={handleCreateRoom}
                disabled={crud.creating || !createForm.name.trim() || createForm.member_ids.length < 2}
              >
                {crud.creating ? "Creando..." : "Crear grupo"}
              </Button>
              <Button variant="secondary" onClick={() => { setShowCreate(false); setCreateForm(defaultCreateForm); }}>Cancelar</Button>
            </div>
          </div>
        </AdminCrudModal>
      )}

      {/* Edit Room Modal */}
      {showEdit && crud.editItem && (
        <AdminCrudModal
          open
          onClose={() => { setShowEdit(null); setEditForm({}); }}
          title="Editar Grupo"
          size="md"
          saving={crud.saving}
          onSave={handleUpdateRoom}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <input
                ref={editAvatarRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="absolute opacity-0 w-0 h-0 pointer-events-none"
                onChange={(e) => handleAvatarUpload(e, "edit")}
              />
              <button
                onClick={() => editAvatarRef.current?.click()}
                className="relative w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-dashed border-outline-variant/40 hover:border-primary/60 transition-colors"
              >
                {editForm.avatar_url ? (
                  <Image
                    src={editForm.avatar_url}
                    alt="Avatar"
                    fill
                    className="object-cover"
                    unoptimized={editForm.avatar_url?.startsWith("http://localhost:8000/uploads/") ?? false}
                  />
                ) : (
                  <MaterialIcon name="add_a_photo" className="text-2xl text-outline-variant" />
                )}
              </button>
              <div>
                <p className="text-body-md text-on-surface font-medium">Foto del grupo</p>
                <p className="text-label-sm text-on-surface-variant">Click para cambiar.</p>
              </div>
            </div>

            <FormField label="Nombre del grupo" required>
              <InputField
                value={editForm.name || ""}
                onChange={(v: string) => setEditForm((prev) => ({ ...prev, name: v }))}
              />
            </FormField>
            <FormField label="Descripcion">
              <TextareaField
                value={editForm.description || ""}
                onChange={(v: string) => setEditForm((prev) => ({ ...prev, description: v }))}
                rows={3}
              />
            </FormField>
            <div className="flex gap-4 pt-4 justify-end">
              <Button variant="primary" onClick={handleUpdateRoom} disabled={crud.saving}>
                {crud.saving ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button variant="secondary" onClick={() => { setShowEdit(null); setEditForm({}); }}>Cancelar</Button>
            </div>
          </div>
        </AdminCrudModal>
      )}

      {/* Members Modal */}
      {showMembers && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl glass-card rounded-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
              <h2 className="font-display text-headline-lg text-on-surface">Gestionar Miembros</h2>
              <button
                onClick={() => { setShowMembers(null); setSelectedMembers([]); setMemberSearch(""); }}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto max-h-[60vh]">
              <div>
                <label className="block text-label-sm text-on-surface-variant mb-2">Buscar usuarios para agregar</label>
                <div className="relative">
                  <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant" />
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Buscar por nombre o correo..."
                    className="w-full bg-surface-container-low rounded-xl pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto space-y-1">
                {availableUsers.length === 0 ? (
                  <div className="py-8 text-center text-on-surface-variant">
                    <MaterialIcon name="person_search" className="text-4xl mb-2 block mx-auto" />
                    <p>Todos los usuarios ya estan en el grupo</p>
                  </div>
                ) : (
                  availableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedMembers((prev) => [...prev, u.id])}
                      className="flex items-center gap-3 px-4 py-3 w-full text-left hover:bg-surface-container-high rounded-xl transition-colors"
                    >
                      <Avatar src={u.avatar_url} alt={u.name} size="sm" initials={getInitials(u.name)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface truncate">{u.name}</p>
                        <p className="text-label-sm text-on-surface-variant truncate">{u.email}</p>
                      </div>
                      <MaterialIcon name="add_circle" className="text-primary text-xl" />
                    </button>
                  ))
                )}
              </div>
              {(usersPage?.has_more || (availableUsers.length === allUsers.length && allUsers.length > 0)) && (
                <div className="pt-2 text-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadMoreUsers}
                    disabled={usersLoadingMore}
                  >
                    {usersLoadingMore ? "Cargando..." : "Cargar más usuarios"}
                  </Button>
                </div>
              )}

              <div className="pt-4 border-t border-outline-variant/20">
                <h4 className="text-title-md font-display text-on-surface mb-3">Miembros actuales ({selectedMembers.length})</h4>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {selectedMembers.length === 0 ? (
                    <div className="py-4 text-center text-on-surface-variant">Sin miembros</div>
                  ) : (
                    selectedMembers.map((memberId) => {
                      const member = allUsers.find((u) => u.id === memberId);
                      if (!member) return null;
                      return (
                        <div key={member.id} className="flex items-center gap-3 px-4 py-2 bg-surface-container-low rounded-xl">
                          <Avatar src={member.avatar_url} alt={member.name} size="sm" initials={getInitials(member.name)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-body-md text-on-surface truncate">{member.name}</p>
                            <p className="text-label-sm text-on-surface-variant truncate">{member.email}</p>
                          </div>
                          <button
                            onClick={() => setSelectedMembers((prev) => prev.filter((id) => id !== memberId))}
                            className="p-1 rounded-full hover:bg-error-container text-error transition-colors"
                            title="Quitar"
                          >
                            <MaterialIcon name="remove_circle" className="text-lg" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-4 pt-4 justify-end">
                <Button variant="secondary" onClick={() => { setShowMembers(null); setSelectedMembers([]); setMemberSearch(""); }}>Cancelar</Button>
                <Button variant="primary" onClick={() => handleAddMembers(showMembers!)} disabled={selectedMembers.length === 0}>
                  Agregar miembros
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, ChatRoomBrief, User } from "@/lib/api";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import SearchBar from "@/components/ui/SearchBar";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminGroupsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [rooms, setRooms] = useState<ChatRoomBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState<string | null>(null);
  const [showMembers, setShowMembers] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [newRoom, setNewRoom] = useState({
    name: "",
    description: "",
    type: "group",
    member_ids: [] as string[],
  });
  const [editRoom, setEditRoom] = useState<ChatRoomBrief | null>(null);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [addingMembers, setAddingMembers] = useState(false);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    (async () => {
      try {
        const [roomsData, usersData] = await Promise.all([
          api.getRooms(),
          api.getUsers(),
        ]);
        setRooms(roomsData);
        setAllUsers(usersData.filter((u) => u.id !== user?.id));
      } catch (e) {
        console.error("Error loading data", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, router]);

  const loadData = async () => {
    try {
      const [roomsData, usersData] = await Promise.all([
        api.getRooms(),
        api.getUsers(),
      ]);
      setRooms(roomsData);
      setAllUsers(usersData.filter((u) => u.id !== user?.id));
    } catch (e) {
      console.error("Error loading data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) return;
    setCreating(true);
    try {
      await api.createRoom(newRoom);
      setShowCreate(false);
      setNewRoom({ name: "", description: "", type: "group", member_ids: [] });
      await loadData();
    } catch (e) {
      console.error("Error creating room", e);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRoom = async () => {
    if (!editRoom) return;
    setUpdating(true);
    try {
      await api.updateRoom(editRoom.id, {
        name: editRoom.name,
        description: editRoom.description,
        avatar_url: editRoom.avatar_url,
      });
      setShowEdit(null);
      await loadData();
    } catch (e) {
      console.error("Error updating room", e);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm("¿Eliminar este grupo? Se borrarán todos sus mensajes.")) return;
    try {
      await api.deleteRoom(roomId);
      await loadData();
    } catch (e) {
      console.error("Error deleting room", e);
    }
  };

  const handleAddMembers = async (roomId: string) => {
    if (selectedMembers.length === 0) return;
    setAddingMembers(true);
    try {
      for (const memberId of selectedMembers) {
        await api.addRoomMember(roomId, memberId);
      }
      setShowMembers(null);
      setSelectedMembers([]);
      setMemberSearch("");
      await loadData();
    } catch (e) {
      console.error("Error adding members", e);
    } finally {
      setAddingMembers(false);
    }
  };

  const openEdit = (room: ChatRoomBrief) => {
    setEditRoom({ ...room });
    setShowEdit(room.id);
  };

  const openMembers = async (room: ChatRoomBrief) => {
    setShowMembers(room.id);
    // Fetch full room to get members
    try {
      const fullRoom = await api.getRoom(room.id);
      setSelectedMembers(fullRoom.members.map((m) => m.user_id));
    } catch (e) {
      console.error("Error fetching room", e);
      setSelectedMembers([]);
    }
  };

  const filteredRooms = rooms.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.description?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter(
    (u) =>
      u.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const availableUsers = filteredUsers.filter(
    (u) => !selectedMembers.includes(u.id)
  );

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Gestión de Grupos
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Crea y administra grupos de chat. Solo administradores.
          </p>
        </div>
        <Button variant="primary" icon="add" iconPosition="left" onClick={() => setShowCreate(true)}>
          Nuevo Grupo
        </Button>
      </div>

      <GlassCard>
        <div className="p-4 border-b border-outline-variant/20">
          <SearchBar
            placeholder="Buscar grupos..."
            value={search}
            onChange={setSearch}
            size="md"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                  Grupo
                </th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                  Miembros
                </th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">
                  Creador
                </th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                  Creado
                </th>
                <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right pr-6">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
                      <p className="text-on-surface-variant text-body-md">Cargando grupos...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredRooms.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
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
                      <p className="text-label-sm text-on-surface-variant">
                        {allUsers.find((u) => u.id === room.created_by)?.name || room.created_by}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-label-sm text-on-surface-variant">{formatDate(room.created_at)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
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
      </GlassCard>

      {/* Create Room Modal */}
      {showCreate && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Crear Nuevo Grupo" size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Nombre del grupo *</label>
              <input
                type="text"
                value={newRoom.name}
                onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })}
                placeholder="Ej: Profesores de Hogwarts"
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Descripción</label>
              <textarea
                value={newRoom.description}
                onChange={(e) => setNewRoom({ ...newRoom, description: e.target.value })}
                placeholder="Descripción opcional..."
                rows={3}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors resize-none"
              />
            </div>
            <div className="flex gap-4 pt-4 justify-end">
              <Button variant="primary" onClick={handleCreateRoom} disabled={creating || !newRoom.name.trim()}>
                {creating ? "Creando..." : "Crear grupo"}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Room Modal */}
      {showEdit && editRoom && (
        <Modal open={true} onClose={() => setShowEdit(null)} title="Editar Grupo" size="md">
          <div className="space-y-4">
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Nombre del grupo *</label>
              <input
                type="text"
                value={editRoom.name}
                onChange={(e) => setEditRoom({ ...editRoom, name: e.target.value })}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
              />
            </div>
            <div>
              <label className="block text-label-sm text-on-surface-variant mb-1">Descripción</label>
              <textarea
                value={editRoom.description ?? ""}
                onChange={(e) => setEditRoom({ ...editRoom, description: e.target.value })}
                rows={3}
                className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors resize-none"
              />
            </div>
            <div className="flex gap-4 pt-4 justify-end">
              <Button variant="primary" onClick={handleUpdateRoom} disabled={updating}>
                {updating ? "Guardando..." : "Guardar cambios"}
              </Button>
              <Button variant="secondary" onClick={() => setShowEdit(null)}>Cancelar</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Members Modal */}
      {showMembers && (
        <Modal open={true} onClose={() => { setShowMembers(null); setSelectedMembers([]); setMemberSearch(""); }} title="Gestionar Miembros" size="lg">
          <div className="space-y-4">
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
                  <p>Todos los usuarios ya están en el grupo</p>
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
              <Button variant="primary" onClick={() => handleAddMembers(showMembers!)} disabled={addingMembers || selectedMembers.length === 0}>
                {addingMembers ? "Agregando..." : "Agregar miembros"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
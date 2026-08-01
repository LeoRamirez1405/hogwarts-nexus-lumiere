"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Button from "@/components/ui/Button";
import Avatar from "@/components/ui/Avatar";
import type { User } from "@/lib/api";

export function MembersModal({
  open,
  onClose,
  roomId,
  memberSearch,
  setMemberSearch,
  selectedMembers,
  setSelectedMembers,
  availableUsers,
  usersLoadingMore,
  loadMoreUsers,
  onAddMembers,
  currentMembers,
  onRemoveMember,
}: {
  open: boolean;
  onClose: () => void;
  roomId: string | null;
  memberSearch: string;
  setMemberSearch: (s: string) => void;
  selectedMembers: string[];
  setSelectedMembers: React.Dispatch<React.SetStateAction<string[]>>;
  availableUsers: User[];
  usersLoadingMore: boolean;
  loadMoreUsers: () => void;
  onAddMembers: (roomId: string) => Promise<void>;
  currentMembers: User[];
  onRemoveMember: (memberId: string) => void;
}) {
  if (!open) return null;

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl glass-card rounded-2xl max-h-[80vh] overflow-hidden">
        <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between">
          <h2 className="font-display text-headline-lg text-on-surface">Gestionar Miembros</h2>
          <button
            onClick={onClose}
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
          {(availableUsers.length > 0) && (
            <div className="pt-2 text-center">
              <Button variant="ghost" size="sm" onClick={loadMoreUsers} disabled={usersLoadingMore}>
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
                currentMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-4 py-2 bg-surface-container-low rounded-xl">
                    <Avatar src={member.avatar_url ?? undefined} alt={member.name} size="sm" initials={getInitials(member.name)} />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md text-on-surface truncate">{member.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{member.email}</p>
                    </div>
                    <button
                      onClick={() => onRemoveMember(member.id)}
                      className="p-1 rounded-full hover:bg-error-container text-error transition-colors"
                      title="Quitar"
                    >
                      <MaterialIcon name="remove_circle" className="text-lg" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex gap-4 pt-4 justify-end">
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button variant="primary" onClick={() => onAddMembers(roomId!)} disabled={selectedMembers.length === 0}>
              Agregar miembros
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
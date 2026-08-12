"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Button from "@/components/ui/Button";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";
import Avatar from "@/components/ui/Avatar";
import type { User } from "@/lib/api";

export function CreateGroupModal({
  open,
  onClose,
  onSave,
  saving,
  form,
  setForm,
  avatarRef,
  onAvatarUpload,
  memberSearch,
  setMemberSearch,
  availableUsers,
  usersLoadingMore,
  loadMoreUsers,
  toggleMember,
  selectedMemberCount,
  usersPage,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (form: {
    name: string;
    description: string;
    type: "group";
    avatar_url: string;
    member_ids: string[];
  }) => Promise<void>;
  saving: boolean;
  form: {
    name: string;
    description: string;
    type: "group";
    avatar_url: string;
    member_ids: string[];
  };
  setForm: React.Dispatch<React.SetStateAction<{
    name: string;
    description: string;
    type: "group";
    avatar_url: string;
    member_ids: string[];
  }>>;
  avatarRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  memberSearch: string;
  setMemberSearch: (s: string) => void;
  availableUsers: User[];
  usersLoadingMore: boolean;
  loadMoreUsers: () => void;
  toggleMember: (userId: string) => void;
  selectedMemberCount: number;
  usersPage: { has_more: boolean } | null;
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
    <AdminCrudModal
      open
      onClose={onClose}
      title="Crear Nuevo Grupo"
      size="md"
      saving={saving}
      saveLabel={saving ? "Creando..." : "Crear grupo"}
      saveDisabled={!form.name.trim() || form.member_ids.length < 2}
      onSave={() => onSave(form)}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={onAvatarUpload}
          />
          <button
            onClick={() => avatarRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-dashed border-outline-variant/40 hover:border-primary/60 transition-colors"
          >
            {form.avatar_url ? (
              <Image
                src={form.avatar_url}
                alt="Avatar"
                fill
                className="object-cover"
                unoptimized={isStoredUpload(form.avatar_url)}
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
            value={form.name}
            onChange={(v: string) => setForm((prev) => ({ ...prev, name: v }))}
            placeholder="Ej: Profesores de Hogwarts"
            autoFocus
            firstInput
          />
        </FormField>
        <FormField label="Descripción">
          <TextareaField
            value={form.description || ""}
            onChange={(v: string) => setForm((prev) => ({ ...prev, description: v }))}
            placeholder="Descripción opcional..."
            rows={3}
          />
        </FormField>

        <div>
          <label className="block text-label-sm text-on-surface-variant mb-1">
            Miembros <span className="text-error">(mínimo 2)</span>
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
            {availableUsers.length === 0 ? (
              <p className="py-4 text-center text-on-surface-variant text-label-sm">Sin usuarios</p>
            ) : (
              availableUsers.map((u) => {
                const selected = form.member_ids.includes(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggleMember(u.id)}
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
          {usersPage?.has_more && (
            <div className="pt-2 text-center">
              <Button variant="ghost" size="sm" onClick={loadMoreUsers} disabled={usersLoadingMore}>
                {usersLoadingMore ? "Cargando..." : "Cargar más usuarios"}
              </Button>
            </div>
          )}
          {selectedMemberCount > 0 && (
            <p className="text-label-sm text-primary mt-2">
              {selectedMemberCount} seleccionado(s)
            </p>
          )}
        </div>
      </div>
    </AdminCrudModal>
  );
}
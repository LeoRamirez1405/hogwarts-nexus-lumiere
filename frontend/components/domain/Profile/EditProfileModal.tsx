"use client";

import { useRef, useState, ChangeEvent } from "react";
import Image from "next/image";
import { api, User } from "@/lib/api";
import { Button, MaterialIcon } from "@/components/ui";

interface EditProfileModalProps {
  profile: User;
  authUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: User) => void;
}

export function EditProfileModal({
  profile,
  authUser,
  isOpen,
  onClose,
  onSave,
}: EditProfileModalProps) {
  const [editForm, setEditForm] = useState({
    name: profile?.name ?? "",
    bio: profile?.bio ?? "",
    avatar_url: profile?.avatar_url ?? "",
    house: profile?.house ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!authUser) return;
    setSaving(true);
    try {
      const updated = await api.updateUser(authUser.id, {
        name: editForm.name,
        bio: editForm.bio || undefined,
        avatar_url: editForm.avatar_url || undefined,
        house: editForm.house || undefined,
      });
      onSave(updated);
      onClose();
    } catch {}
    setSaving(false);
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await api.uploadFile(file);
      setEditForm((p) => ({ ...p, avatar_url: result.url }));
    } catch {
      // error handled by api
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto no-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface z-10">
          <h2 className="font-display text-title-md text-on-surface">Editar Perfil</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Casa</label>
            <select
              value={editForm.house}
              onChange={(e) => setEditForm((p) => ({ ...p, house: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            >
              <option value="">Sin casa</option>
              <option value="Gryffindor">Gryffindor</option>
              <option value="Slytherin">Slytherin</option>
              <option value="Ravenclaw">Ravenclaw</option>
              <option value="Hufflepuff">Hufflepuff</option>
            </select>
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Avatar</label>
            <div className="flex items-center gap-3">
              {editForm.avatar_url && (
                <Image
                  src={editForm.avatar_url}
                  alt="Preview"
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                  unoptimized
                />
              )}
              <div className="flex-1">
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="upload"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? "Subiendo..." : "Seleccionar archivo"}
                </Button>
                {editForm.avatar_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="delete"
                    onClick={() => setEditForm((p) => ({ ...p, avatar_url: "" }))}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            </div>
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Biografia (opcional)</label>
            <textarea
              value={editForm.bio}
              onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20 sticky bottom-0 bg-surface">
          <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button variant="primary" onClick={handleSave} disabled={saving || !editForm.name.trim()} className="flex-1">
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
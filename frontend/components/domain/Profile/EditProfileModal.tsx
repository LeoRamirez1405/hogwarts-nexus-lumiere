"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { api, User } from "@/lib/api";
import { Button, MaterialIcon } from "@/components/ui";
import { useImageUpload } from "@/hooks/useFileUpload";

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
  const [showPassword, setShowPassword] = useState(false);
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [passMsg, setPassMsg] = useState<string | null>(null);
  const [passSaving, setPassSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { handleFileSelect, uploading } = useImageUpload({
    onSuccess: (result) => {
      setEditForm((p) => ({ ...p, avatar_url: result.url }));
    },
  });

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

  const handleChangePassword = async () => {
    if (!currentPass || !newPass) return;
    if (newPass !== confirmPass) { setPassMsg("Las contrasenas no coinciden"); return; }
    if (newPass.length < 4) { setPassMsg("Minimo 4 caracteres"); return; }
    setPassSaving(true);
    setPassMsg(null);
    try {
      await api.changePassword(currentPass, newPass);
      setPassMsg("Contrasena actualizada");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (e: unknown) {
      setPassMsg(e instanceof Error ? e.message : "Error al cambiar contrasena");
    }
    setPassSaving(false);
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
                  className="absolute opacity-0 w-0 h-0 pointer-events-none"
                  onChange={handleFileSelect}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  icon="upload"
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? "Subiendo..." : "Seleccionar archivo"}
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

          {/* Password Change */}
          <div className="border-t border-outline-variant/20 pt-4">
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-primary transition-colors mb-3"
            >
              <MaterialIcon name="lock" className="text-lg" />
              <span className="font-medium">{showPassword ? "Ocultar" : "Cambiar contrasena"}</span>
              <MaterialIcon name={showPassword ? "expand_less" : "expand_more"} className="text-lg" />
            </button>
            {showPassword && (
              <div className="space-y-3">
                <input
                  type="password"
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="Contrasena actual"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
                <input
                  type="password"
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Nueva contrasena"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
                <input
                  type="password"
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Confirmar contrasena"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
                {passMsg && (
                  <p className={`text-label-sm ${passMsg.includes("Error") || passMsg.includes("no coinciden") ? "text-error" : "text-success"}`}>
                    {passMsg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleChangePassword}
                  disabled={passSaving || !currentPass || !newPass}
                  className="w-full py-2.5 rounded-xl bg-primary text-on-primary text-label-sm font-bold disabled:opacity-40 transition-all active:scale-95"
                >
                  {passSaving ? "Guardando..." : "Actualizar contrasena"}
                </button>
              </div>
            )}
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
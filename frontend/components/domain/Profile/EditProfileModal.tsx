"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { api, User } from "@/lib/api";
import { Button, Modal, BottomSheet, MaterialIcon } from "@/components/ui";
import { useImageUpload } from "@/hooks/useFileUpload";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface EditProfileModalProps {
  profile: User;
  authUser: User;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: User) => void;
}

function EditProfileForm({
  profile,
  authUser,
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
  const {
    textareaRef: bioRef,
    height: bioHeight,
  } = useAutoResizeTextarea({ minHeight: 100, maxHeight: 240 });

  const { handleFileSelect, uploading } = useImageUpload({
    onSuccess: (result) => {
      setEditForm((p) => ({ ...p, avatar_url: result.url }));
    },
  });

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
    if (newPass !== confirmPass) { setPassMsg("Las contraseñas no coinciden"); return; }
    if (newPass.length < 4) { setPassMsg("Mínimo 4 caracteres"); return; }
    setPassSaving(true);
    setPassMsg(null);
    try {
      await api.changePassword(currentPass, newPass);
      setPassMsg("Contraseña actualizada");
      setCurrentPass(""); setNewPass(""); setConfirmPass("");
    } catch (e: unknown) {
      setPassMsg(e instanceof Error ? e.message : "Error al cambiar contraseña");
    }
    setPassSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
        <input
          type="text"
          value={editForm.name}
          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
          enterKeyHint="next"
          autoComplete="name"
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
        <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Biografía (opcional)</label>
        <textarea
          ref={bioRef}
          style={{ height: bioHeight }}
          value={editForm.bio}
          onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
          enterKeyHint="done"
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors resize-none"
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
          <span className="font-medium">{showPassword ? "Ocultar" : "Cambiar contraseña"}</span>
          <MaterialIcon name={showPassword ? "expand_less" : "expand_more"} className="text-lg" />
        </button>
        {showPassword && (
          <div className="space-y-3">
            <input
              type="password"
              value={currentPass}
              onChange={(e) => setCurrentPass(e.target.value)}
              placeholder="Contraseña actual"
              autoComplete="current-password"
              enterKeyHint="next"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Nueva contraseña"
              autoComplete="new-password"
              enterKeyHint="next"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            <input
              type="password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              placeholder="Confirmar contraseña"
              autoComplete="new-password"
              enterKeyHint="done"
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
              {passSaving ? "Guardando..." : "Actualizar contraseña"}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !editForm.name.trim()} className="flex-1">
          {saving ? "Guardando..." : "Guardar"}
        </Button>
      </div>
    </div>
  );
}

export function EditProfileModal(props: EditProfileModalProps) {
  // Both Modal and BottomSheet portal their content into document.body, so the
  // className-based `hidden`/`md:hidden` wrapper pattern does NOT suppress the
  // wrong one — both would render on top of each other when `isOpen`. Pick the
  // right component explicitly via a media query and render only that one.
  const isDesktop = useIsDesktopMdUp();

  if (!props.isOpen) return null;

  if (isDesktop) {
    return (
      <Modal open={props.isOpen} onClose={props.onClose} title="Editar Perfil" size="md">
        <EditProfileForm {...props} />
      </Modal>
    );
  }

  return (
    <BottomSheet open={props.isOpen} onClose={props.onClose} title="Editar Perfil">
      <EditProfileForm {...props} />
    </BottomSheet>
  );
}
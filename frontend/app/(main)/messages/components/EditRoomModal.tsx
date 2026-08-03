"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { Button, Modal, BottomSheet } from "@/components/ui";
import { useImageUpload } from "@/hooks/useFileUpload";
import { useAutoResizeTextarea } from "@/hooks/useAutoResizeTextarea";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface EditRoomModalProps {
  roomId: string;
  roomName: string;
  roomAvatar?: string;
  roomDescription?: string;
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function EditRoomForm({
  roomId,
  roomName,
  roomAvatar,
  roomDescription,
  onClose,
  onRefresh,
}: EditRoomModalProps) {
  const [editForm, setEditForm] = useState({
    name: roomName ?? "",
    description: roomDescription ?? "",
    avatar_url: roomAvatar ?? "",
  });
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const {
    textareaRef: descRef,
    height: descHeight,
  } = useAutoResizeTextarea({ minHeight: 80, maxHeight: 200 });

  const { handleFileSelect, uploading } = useImageUpload({
    onSuccess: (result) => {
      setEditForm((p) => ({ ...p, avatar_url: result.url }));
    },
  });

  const handleSave = async () => {
    if (!editForm.name.trim()) return;
    setSaving(true);
    try {
      await api.updateRoom(roomId, {
        name: editForm.name,
        description: editForm.description || undefined,
        avatar_url: editForm.avatar_url || undefined,
      });
      onRefresh();
      onClose();
    } catch (e: unknown) {
      console.error("Error updating room:", e);
      alert("Error al actualizar el grupo");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre del grupo</label>
        <input
          type="text"
          value={editForm.name}
          onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
          enterKeyHint="next"
          autoComplete="name"
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
          maxLength={100}
        />
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
        <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Descripción (opcional)</label>
        <textarea
          ref={descRef}
          style={{ height: descHeight }}
          value={editForm.description}
          onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
          enterKeyHint="done"
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors resize-none"
          maxLength={500}
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1">Cancelar</Button>
        <Button variant="primary" onClick={handleSave} disabled={saving || !editForm.name.trim()} className="flex-1">
          {saving ? "Guardando..." : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}

export function EditRoomModal(props: EditRoomModalProps) {
  const isDesktop = useIsDesktopMdUp();

  if (!props.isOpen) return null;

  if (isDesktop) {
    return (
      <Modal open={props.isOpen} onClose={props.onClose} title="Editar Grupo" size="md">
        <EditRoomForm {...props} />
      </Modal>
    );
  }

  return (
    <BottomSheet open={props.isOpen} onClose={props.onClose} title="Editar Grupo">
      <EditRoomForm {...props} />
    </BottomSheet>
  );
}
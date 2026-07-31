"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { api, Post } from "@/lib/api";
import { mediaSrc } from "@/lib/media";
import { Modal, Button, MaterialIcon } from "@/components/ui";
import { toastError } from "@/lib/toastStore";

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onSaved?: (updated: Post) => void;
}

export const EditPostModal = memo(function EditPostModal({
  post,
  onClose,
  onSaved,
}: EditPostModalProps) {
  const [editText, setEditText] = useState(post.body);
  const [editImageUrl, setEditImageUrl] = useState(post.image_url ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const text = editText.trim();
    if (!text || saving) return;
    setSaving(true);
    try {
      const updated = await api.updatePost(post.id, {
        body: text,
        image_url: editImageUrl || undefined,
      });
      onSaved?.(updated);
      onClose();
    } catch (e) {
      toastError("No se pudo editar la publicacion", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={() => !saving && onClose()} title="Editar publicación" size="md">
      <div className="space-y-4">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Que esta pasando en tu mundo magico?"
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none resize-none border border-outline-variant/20 focus:border-primary/40 transition-colors min-h-28"
          autoFocus
        />
        {editImageUrl && (
          <div className="relative rounded-xl overflow-hidden">
            <Image
              src={mediaSrc(editImageUrl)}
              alt="Preview"
              width={400}
              height={250}
              className="w-full h-40 object-cover rounded-xl"
              unoptimized
            />
            <button
              onClick={() => setEditImageUrl("")}
              className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label="Quitar imagen"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="check"
            onClick={handleSave}
            disabled={!editText.trim() || saving}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

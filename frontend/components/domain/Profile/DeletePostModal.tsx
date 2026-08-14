"use client";

import { memo, useState } from "react";
import { api, Post } from "@/lib/api";
import { Modal, Button, MaterialIcon } from "@/components/ui";
import { toastError } from "@/lib/toastStore";

interface DeletePostModalProps {
  post: Post;
  onClose: () => void;
  onDeleted?: (id: string) => void;
}

export const DeletePostModal = memo(function DeletePostModal({
  post,
  onClose,
  onDeleted,
}: DeletePostModalProps) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.deletePost(post.id);
      onDeleted?.(post.id);
      onClose();
    } catch (e) {
      toastError("No se pudo eliminar la publicación", e);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => !deleting && onClose()}
      title="Eliminar publicación"
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-error/10 text-error shrink-0">
            <MaterialIcon name="delete" className="text-xl" />
          </div>
          <p className="text-body-md text-on-surface-variant">
            ¿Seguro que deseas eliminar esta publicación? Esta acción no se
            puede deshacer.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={deleting}
          >
            Cancelar
          </Button>
          <Button
            variant="danger"
            size="sm"
            icon="delete"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
});

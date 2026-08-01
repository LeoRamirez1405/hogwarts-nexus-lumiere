"use client";

import { useCallback } from "react";
import { api, ChatRoomBrief } from "@/lib/api";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toastError, toastSuccess } from "@/lib/toastStore";

type CreateFormInput = {
  name: string;
  description: string;
  type: string;
  member_ids: string[];
  avatar_url: string;
};

type CrudLike = {
  handleCreate: (data: Record<string, unknown>) => Promise<void>;
  handleSave: (id: string, data: Partial<ChatRoomBrief>) => Promise<void>;
  handleDelete: (id: string) => void;
};

export function useGroupActions(crud: CrudLike, refresh: () => Promise<void>) {
  const handleCreateRoom = useCallback(
    async (form: CreateFormInput) => {
      if (!form.name.trim() || form.member_ids.length < 2) return;
      await crud.handleCreate(form as unknown as Record<string, unknown>);
    },
    [crud]
  );

  const handleUpdateRoom = useCallback(
    async (id: string, form: Partial<ChatRoomBrief>) => {
      await crud.handleSave(id, form);
    },
    [crud]
  );

  const handleDeleteRoom = useCallback(
    (id: string) => {
      confirmDialog({
        title: "Eliminar grupo?",
        message: "Se borraran todos sus mensajes. Esta accion no se puede deshacer.",
        variant: "danger",
        icon: "delete",
        onConfirm: () => crud.handleDelete(id),
      });
    },
    [crud]
  );

  const handleToggleClose = useCallback(
    async (id: string) => {
      try {
        const updated = await api.toggleRoomClosed(id);
        await refresh();
        toastSuccess(updated.closed ? "Grupo cerrado — solo admins pueden hablar" : "Grupo reabierto");
      } catch (e) {
        toastError("No se pudo cambiar el estado del grupo", e);
      }
    },
    [refresh]
  );

  const handleAddMembers = useCallback(
    async (roomId: string, memberIds: string[]) => {
      if (memberIds.length === 0) return;
      try {
        await api.addRoomMembersBatch(roomId, memberIds);
        toastSuccess("Miembros agregados");
        await refresh();
      } catch (e) {
        toastError("No se pudieron agregar los miembros", e);
      }
    },
    [refresh]
  );

  return {
    handleCreateRoom,
    handleUpdateRoom,
    handleDeleteRoom,
    handleToggleClose,
    handleAddMembers,
  };
}
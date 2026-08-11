"use client";

import { useState, useEffect, useCallback } from "react";
import { api, Message } from "@/lib/api";
import { MaterialIcon } from "./helpers";
import { Avatar } from "@/components/ui";
import BottomSheet from "@/components/ui/BottomSheet";
import DateTimePickerModal from "./components/DateTimePickerModal";
import { toastSuccess, toastError } from "@/lib/toastStore";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

export interface ScheduledConvFilter {
  type: "room" | "dm";
  id: string;
}

function formatScheduledTime(isoString: string): string {
  try {
    return new Date(isoString).toLocaleString("es-ES", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function kindPreview(msg: Message): string {
  if (msg.body?.trim()) return msg.body;
  switch (msg.kind) {
    case "image": return "Imagen";
    case "video": return "Video";
    case "audio": return "Audio";
    case "voice": return "Nota de voz";
    case "sticker": return "Sticker";
    case "document": return "Documento";
    case "poll": return "Encuesta";
    default: return "Adjunto";
  }
}

function matchesConv(msg: Message, filter: ScheduledConvFilter | null | undefined): boolean {
  if (!filter) return true;
  if (filter.type === "room") return msg.room_id === filter.id;
  return msg.receiver_id === filter.id;
}

export default function ScheduledMessagesModal({
  onSelectMessage,
  onClose,
  filterConv,
}: {
  onSelectMessage: (msg: Message) => void;
  onClose: () => void;
  filterConv?: ScheduledConvFilter | null;
}) {
  const isDesktop = useIsDesktopMdUp(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [editScheduleAt, setEditScheduleAt] = useState<string | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const filtered = messages.filter((m) => matchesConv(m, filterConv));

  useEffect(() => {
    let cancelled = false;
    api
      .getScheduledMessages()
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setMessages([]);
        setLoading(false);
        toastError("No se pudieron cargar los mensajes programados", err);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const msgs = await api.getScheduledMessages();
      setMessages(msgs);
    } catch (err) {
      toastError("No se pudieron cargar los mensajes programados", err);
    }
  }, []);

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditBody(msg.body || "");
    setEditScheduleAt(msg.scheduled_at ?? null);
    setShowTimePicker(false);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditScheduleAt(null);
    setShowTimePicker(false);
  };

  const saveEdit = async (msg: Message) => {
    if (!editBody.trim() && !editScheduleAt) {
      toastError("Escribe un mensaje o cambia la hora");
      return;
    }
    setSaving(true);
    try {
      await api.updateScheduledMessage(msg.id, {
        body: editBody.trim() || undefined,
        scheduled_at: editScheduleAt ?? undefined,
      });
      toastSuccess("Mensaje actualizado", `Se enviará ${formatScheduledTime(editScheduleAt ?? msg.scheduled_at ?? "")}`);
      cancelEdit();
      await fetchMessages();
      setSaving(false);
    } catch (err) {
      setSaving(false);
      toastError("No se pudo actualizar el mensaje", err);
    }
  };

  const cancelMessage = async (msg: Message) => {
    try {
      await api.cancelScheduledMessage(msg.id);
      toastSuccess("Mensaje cancelado", "Ya no se enviará");
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
      if (editingId === msg.id) cancelEdit();
    } catch (err) {
      toastError("No se pudo cancelar el mensaje", err);
    }
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="py-12 text-center">
          <MaterialIcon
            name="progress_activity"
            className="text-4xl text-outline-variant animate-spin mb-2 block mx-auto"
          />
          <p className="text-on-surface-variant text-body-md">
            Cargando programados
          </p>
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="py-12 text-center">
          <MaterialIcon
            name="schedule"
            className="text-4xl text-outline-variant mb-2 block mx-auto"
          />
          <p className="text-on-surface-variant text-body-md">
            {filterConv
              ? "No tienes mensajes programados en este chat"
              : "No tienes mensajes programados"}
          </p>
          {!filterConv && (
            <p className="text-on-surface-variant/60 text-label-sm mt-1">
              Usa la opción &ldquo;Programar mensaje&rdquo; en el chat
            </p>
          )}
        </div>
      );
    }
    return filtered.map((msg) => {
      const targetName = msg.room?.name || msg.receiver?.name || "Chat";
      const isEditing = editingId === msg.id;
      return (
        <div
          key={msg.id}
          className="px-6 py-3 border-b border-outline-variant/10 hover:bg-surface-container-low transition-colors"
        >
          <div className="flex items-start gap-3">
            <Avatar
              src={
                msg.room
                  ? msg.room.avatar_url
                  : msg.receiver?.avatar_url
              }
              alt={targetName}
              size="sm"
              initials={targetName.slice(0, 2).toUpperCase()}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-body-md font-medium text-on-surface truncate">
                  {targetName}
                </p>
                {msg.room && (
                  <span className="inline-flex items-center gap-1 text-label-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                    <MaterialIcon name="group" className="text-xs" />
                    Grupo
                  </span>
                )}
              </div>

              {isEditing ? (
                <div className="mt-2">
                  <EditForm
                    editBody={editBody}
                    onBodyChange={setEditBody}
                    editScheduleAt={editScheduleAt}
                    onPickTime={() => setShowTimePicker(true)}
                    saving={saving}
                    onSave={() => saveEdit(msg)}
                    onCancel={cancelEdit}
                  />
                </div>
              ) : (
                <>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {kindPreview(msg)}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-label-xs px-2 py-0.5 rounded-full bg-secondary-container/50 text-secondary font-medium">
                      <MaterialIcon name="schedule" className="text-xs" />
                      {msg.scheduled_at
                        ? formatScheduledTime(msg.scheduled_at)
                        : "—"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {!isEditing && (
            <div className="flex items-center gap-2 mt-2 pl-11">
              <button
                type="button"
                onClick={() => startEdit(msg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-medium text-primary hover:bg-primary/10 transition-colors"
              >
                <MaterialIcon name="edit" className="text-sm" />
                Editar
              </button>
              {!filterConv && (
                <button
                  type="button"
                  onClick={() => onSelectMessage(msg)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-medium text-secondary hover:bg-secondary/10 transition-colors"
                >
                  <MaterialIcon name="forum" className="text-sm" />
                  Ver chat
                </button>
              )}
              <button
                type="button"
                onClick={() => cancelMessage(msg)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-label-sm font-medium text-error hover:bg-error/10 transition-colors"
              >
                <MaterialIcon name="close" className="text-sm" />
                Cancelar
              </button>
            </div>
          )}
        </div>
      );
    });
  };

  const title = "Mensajes programados";

  if (isDesktop) {
    return (
      <>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 shrink-0">
              <h2 className="font-display text-title-md text-on-surface flex items-center gap-2">
                <MaterialIcon name="schedule" className="text-secondary" />
                {title}
              </h2>
              <button
                onClick={onClose}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                aria-label="Cerrar"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar">
              {renderList()}
            </div>
          </div>
        </div>

        <DateTimePickerModal
          isOpen={showTimePicker}
          onClose={() => setShowTimePicker(false)}
          initialDateTime={editScheduleAt ?? undefined}
          title="Cambiar hora de envío"
          onConfirm={(isoString) => {
            setEditScheduleAt(isoString);
            setShowTimePicker(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <BottomSheet
        open
        onClose={onClose}
        title={title}
        ariaLabel="Mensajes programados"
      >
        <div className="flex items-center gap-2 mb-3 text-on-surface-variant text-label-sm">
          <MaterialIcon name="schedule" className="text-base" />
          {filterConv
            ? "Programados en este chat"
            : "Todos tus mensajes programados"}
        </div>
        {renderList()}
      </BottomSheet>

      <DateTimePickerModal
        isOpen={showTimePicker}
        onClose={() => setShowTimePicker(false)}
        initialDateTime={editScheduleAt ?? undefined}
        title="Cambiar hora de envío"
        onConfirm={(isoString) => {
          setEditScheduleAt(isoString);
          setShowTimePicker(false);
        }}
      />
    </>
  );
}

function EditForm({
  editBody,
  onBodyChange,
  editScheduleAt,
  onPickTime,
  saving,
  onSave,
  onCancel,
}: {
  editBody: string;
  onBodyChange: (value: string) => void;
  editScheduleAt: string | null;
  onPickTime: () => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-2">
      <textarea
        value={editBody}
        onChange={(e) => onBodyChange(e.target.value)}
        placeholder="Mensaje..."
        rows={2}
        className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-body-sm text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
      />
      <button
        type="button"
        onClick={onPickTime}
        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary-container/40 text-secondary text-label-sm font-medium hover:bg-secondary-container/60 transition-colors"
      >
        <MaterialIcon name="schedule" className="text-base" />
        {editScheduleAt
          ? `Hora: ${formatScheduledTime(editScheduleAt)}`
          : "Cambiar hora…"}
      </button>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex-1 px-4 py-2 rounded-xl text-label-md font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity disabled:opacity-40 disabled:pointer-events-none"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-label-md font-medium text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import { ReactionPicker } from "./ReactionPicker";
import type { MessageActionsProps } from "./types";

export const MessageActions = ({
  message,
  isOwn,
  open = false,
  onOpenChange,
  onReply,
  onTogglePin,
  onToggleStar,
  onForward,
  onEdit,
  onDelete,
  onReactionChange,
}: MessageActionsProps) => {
  const ref = useRef<HTMLDivElement>(null);

  // Cerrar al tocar/clickear fuera (móvil) o con Escape
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onOpenChange?.(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange?.(false);
    };
    document.addEventListener("mousedown", handle);
    document.addEventListener("touchstart", handle);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handle);
      document.removeEventListener("touchstart", handle);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onOpenChange]);

  const runAction = (fn?: () => void) => {
    onOpenChange?.(false);
    fn?.();
  };

  return (
    <div ref={ref} className="relative flex flex-col items-center">
      <div
        className={`flex flex-col gap-0.5 p-1.5 rounded-2xl glass-card shadow-lg transition-opacity ${
          open
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto"
        }`}
      >
        {onReply && (
          <button
            type="button"
            onClick={() => runAction(() => onReply(message))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Responder"
          >
            <MaterialIcon name="reply" className="text-base" />
          </button>
        )}
        {onTogglePin && (
          <button
            type="button"
            onClick={() => runAction(() => onTogglePin(message))}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors ${
              message.pinned ? "text-primary" : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
            title={message.pinned ? "Dejar de fijar" : "Fijar mensaje"}
          >
            <MaterialIcon name="push_pin" className="text-base" filled={message.pinned} />
          </button>
        )}
        {onToggleStar && (
          <button
            type="button"
            onClick={() => runAction(() => onToggleStar(message))}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors ${
              message.starred ? "text-warning" : "text-on-surface-variant/60 hover:text-warning"
            }`}
            title={message.starred ? "Quitar de destacados" : "Destacar mensaje"}
          >
            <MaterialIcon name="star" className="text-base" filled={message.starred} />
          </button>
        )}
        {onForward && (
          <button
            type="button"
            onClick={() => runAction(() => onForward(message))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Reenviar"
          >
            <MaterialIcon name="forward" className="text-base" />
          </button>
        )}
        <ReactionPicker messageId={message.id} onReacted={onReactionChange} />
        {isOwn && onEdit && message.kind === "text" && !message.edited && (
          <button
            type="button"
            onClick={() => runAction(() => onEdit(message))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Editar"
          >
            <MaterialIcon name="edit" className="text-base" />
          </button>
        )}
        {isOwn && onDelete && (
          <button
            type="button"
            onClick={() => runAction(() => onDelete(message))}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-error-container/30 text-error/60 hover:text-error transition-colors"
            title="Eliminar"
          >
            <MaterialIcon name="delete" className="text-base" />
          </button>
        )}
      </div>
    </div>
  );
};

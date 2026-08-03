"use client";

import { MaterialIcon } from "@/components/ui";
import { ReactionPicker } from "./ReactionPicker";
import { FloatingPopover } from "../FloatingPopover";
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
  anchorRef,
}: MessageActionsProps) => {
  const runAction = (fn?: () => void) => {
    onOpenChange?.(false);
    fn?.();
  };

  const content = (
    <div className="flex flex-col gap-0.5 p-1.5">
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
  );

  return (
    <FloatingPopover
      anchorRef={anchorRef}
      open={open}
      onRequestClose={onOpenChange}
      placement={isOwn ? "left" : "right"}
      gap={6}
      maxHeight={400}
      className="w-auto"
    >
      {content}
    </FloatingPopover>
  );
};
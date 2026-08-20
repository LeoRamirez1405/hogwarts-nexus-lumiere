"use client";

import { useCallback } from "react";

interface UseChatInputOptions {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  mentionOpen: boolean;
  onMentionMove: (delta: number) => void;
  onMentionConfirm: () => void;
  onDismissMentions: () => void;
  onCancelEdit?: () => void;
}

export function useChatInput({
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onFileSelect,
  mentionOpen,
  onMentionMove,
  onMentionConfirm,
  onDismissMentions,
  onCancelEdit,
}: UseChatInputOptions) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e.target.value);
    },
    [onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cuando la lista de menciones está abierta, las flechas / Enter / Tab
      // navegan y confirman la sugerencia en lugar de enviar el mensaje.
      if (mentionOpen) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          onMentionMove(1);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          onMentionMove(-1);
          return;
        }
        if ((e.key === "Enter" && !e.shiftKey) || e.key === "Tab") {
          e.preventDefault();
          onMentionConfirm();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          onDismissMentions();
          return;
        }
      }

      // Escape sale del modo edición (estilo WhatsApp/Telegram).
      if (e.key === "Escape" && onCancelEdit) {
        e.preventDefault();
        onCancelEdit();
        return;
      }

      if (e.key === "Enter") {
        // Shift+Enter = nueva línea. Inserto manual para que el primer salto
        // no se pierda por el redondeo del textarea controlado.
        if (e.shiftKey && !e.nativeEvent.isComposing) {
          e.preventDefault();
          const el = e.currentTarget;
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          onInputChange(`${el.value.slice(0, start)}\n${el.value.slice(end)}`);
          requestAnimationFrame(() => {
            const pos = start + 1;
            el.setSelectionRange(pos, pos);
          });
          return;
        }
        if (!e.nativeEvent.isComposing) {
          e.preventDefault();
          onSend();
        }
      }
    },
    [mentionOpen, onMentionMove, onMentionConfirm, onSend, onDismissMentions, onCancelEdit, onInputChange]
  );

  const handleBlur = useCallback(() => {
    onTypingStop();
  }, [onTypingStop]);

  const handleFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, [fileInputRef]);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFileSelect(e);
    },
    [onFileSelect]
  );

  return {
    handleInputChange,
    handleKeyDown,
    handleBlur,
    handleFileClick,
    handleFileChange,
  };
}
"use client";

import { useCallback } from "react";

interface UseChatInputOptions {
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showMentionDropdown: boolean;
  onDismissMentions: () => void;
}

export function useChatInput({
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onFileSelect,
  showMentionDropdown,
  onDismissMentions,
}: UseChatInputOptions) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onInputChange(e.target.value);
    },
    [onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!showMentionDropdown) onSend();
      } else if (e.key === "Escape") {
        onDismissMentions();
      }
    },
    [showMentionDropdown, onSend, onDismissMentions]
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
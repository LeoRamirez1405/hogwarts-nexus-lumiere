"use client";

import { useCallback, useRef, useEffect } from "react";

interface UseChatInputOptions {
  inputRef: React.RefObject<HTMLInputElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (value: string) => void;
  onTypingStop: () => void;
  onSend: () => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  showMentionDropdown: boolean;
  onDismissMentions: () => void;
  uploading: boolean;
}

export function useChatInput({
  inputRef,
  fileInputRef,
  onInputChange,
  onTypingStop,
  onSend,
  onFileSelect,
  showMentionDropdown,
  onDismissMentions,
  uploading,
}: UseChatInputOptions) {
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onInputChange(e.target.value);
    },
    [onInputChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
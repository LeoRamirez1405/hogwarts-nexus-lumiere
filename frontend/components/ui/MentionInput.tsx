"use client";

import { useRef, forwardRef, useLayoutEffect, useCallback, useState } from "react";
import type { TextareaHTMLAttributes, ForwardedRef } from "react";
import MentionDropdown from "@/app/(main)/messages/components/MentionDropdown";
import { useMentions } from "@/hooks/useMentions";

interface MentionInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value" | "ref"> {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isGroup?: boolean;
  friendsOnly?: boolean;
  className?: string;
  textareaClassName?: string;
  maxHeight?: number;
  minHeight?: number;
  disabled?: boolean;
  onSubmit?: () => void;
}

export const MentionInput = forwardRef<HTMLTextAreaElement, MentionInputProps>(
  (
    {
      value,
      onChange,
      placeholder = "Escribe un mensaje...",
      isGroup = false,
      friendsOnly = false,
      className = "",
      textareaClassName,
      maxHeight = 200,
      minHeight = 80,
      disabled = false,
      onSubmit,
      ...props
    },
    ref: ForwardedRef<HTMLTextAreaElement>
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState(minHeight);

    const {
      mentionResults,
      mentionOpen,
      mentionActiveIndex,
      onMentionHover,
      onMentionMove,
      onMentionConfirm,
      onDismissMentions,
      inputRef,
      handleInputChange,
    } = useMentions({
      value,
      onChange,
      isGroup,
      friendsOnly,
    });

    // Auto-resize logic
    const resize = useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      textarea.style.height = "auto";
      const scrollHeight = textarea.scrollHeight;
      const clampedHeight = maxHeight > 0
        ? Math.min(Math.max(scrollHeight, minHeight), maxHeight)
        : Math.max(scrollHeight, minHeight);

      setHeight(clampedHeight);
      textarea.style.height = `${clampedHeight}px`;

      if (maxHeight > 0 && scrollHeight > maxHeight) {
        textarea.style.overflowY = "auto";
      } else {
        textarea.style.overflowY = "hidden";
      }
    }, [minHeight, maxHeight]);

    useLayoutEffect(() => {
      resize();
    }, [resize, value]);

    // Merge refs
    const setCombinedRef = (el: HTMLTextAreaElement | null) => {
      textareaRef.current = el;
      inputRef.current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) ref.current = el;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (mentionOpen) {
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          onMentionConfirm();
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          onMentionMove(1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          onMentionMove(-1);
        } else if (e.key === "Escape") {
          onDismissMentions();
        }
        return;
      }

      if (e.key !== "Enter" || e.nativeEvent.isComposing) return;

      if (e.shiftKey) {
        // Shift+Enter = nueva línea. Se inserta manualmente en la posición del
        // cursor para que el primer salto no se pierda por el redondeo del
        // textarea controlado (el navegador inserta el \n antes de que React
        // sincronice el value y el re-render lo descarta).
        e.preventDefault();
        const el = textareaRef.current;
        if (!el) return;
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        handleInputChange(`${value.slice(0, start)}\n${value.slice(end)}`);
        requestAnimationFrame(() => {
          const pos = start + 1;
          el.setSelectionRange(pos, pos);
        });
        return;
      }

      // Enter envía (estilo chat).
      e.preventDefault();
      onSubmit?.();
    };

    const handleBlur = (e: React.FocusEvent<HTMLTextAreaElement>) => {
      // Delay para permitir click en dropdown
      setTimeout(() => onDismissMentions(), 200);
      props.onBlur?.(e);
    };

    return (
      <div ref={containerRef} className={`relative ${className}`}>
        <textarea
          ref={setCombinedRef}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={textareaClassName ?? "w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none resize-none border border-outline-variant/20 focus:border-primary/40 transition-colors"}
          style={{ height }}
          inputMode="text"
          autoComplete="off"
          enterKeyHint="send"
          {...props}
        />
        {mentionOpen && (
          <MentionDropdown
            results={mentionResults}
            activeIndex={mentionActiveIndex}
            onSelect={onMentionConfirm}
            onHover={onMentionHover}
          />
        )}
      </div>
    );
  }
);

MentionInput.displayName = "MentionInput";
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { SPECIAL_MENTIONS, commandToSuggestion, userToSuggestion } from "@/lib/mentions";
import type { MentionSuggestion, SpecialMention } from "@/lib/mentions";
import { getInitials } from "@/app/(main)/messages/helpers";

interface UseMentionsOptions {
  /** Texto actual del input */
  value: string;
  /** Callback cuando cambia el texto */
  onChange: (value: string) => void;
  /** Si es un chat grupal (para mostrar comandos especiales @all, @alle, etc.) */
  isGroup?: boolean;
  /** Función opcional para filtrar búsqueda (ej: solo amigos) */
  friendsOnly?: boolean;
}

interface UseMentionsReturn {
  /** Resultados de sugerencias de menciones */
  mentionResults: MentionSuggestion[];
  /** Si el dropdown de menciones está visible */
  showMentionDropdown: boolean;
  /** Índice activo en el dropdown */
  mentionActiveIndex: number;
  /** Si hay resultados y dropdown debe mostrarse */
  mentionOpen: boolean;
  /** Handlers para el dropdown */
  onMentionHover: (index: number) => void;
  onMentionMove: (delta: number) => void;
  onMentionConfirm: () => void;
  onDismissMentions: () => void;
  /** Ref para el textarea */
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
  /** Handler para cambios en el textarea (detecta @menciones) */
  handleInputChange: (value: string) => void;
}

/**
 * Hook reutilizable para autocompletado de menciones (@usuario, @all, etc.)
 * Extraído y generalizado de useChatComposer
 */
export function useMentions({
  value,
  onChange,
  isGroup = false,
  friendsOnly = false,
}: UseMentionsOptions): UseMentionsReturn {
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionResults, setMentionResults] = useState<MentionSuggestion[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detectar "@" en el input y activar búsqueda de menciones
  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);
      const atIndex = newValue.lastIndexOf("@");
      if (atIndex >= 0 && (atIndex === 0 || newValue[atIndex - 1] === " ")) {
        const query = newValue.slice(atIndex + 1);
        if (!query.includes(" ")) {
          setMentionSearch(query);
          if (query.length === 0) {
            const commands = isGroup ? SPECIAL_MENTIONS.map(commandToSuggestion) : [];
            setMentionResults(commands);
            setShowMentionDropdown(commands.length > 0);
            setMentionActiveIndex(0);
          }
          return;
        }
      }
      setMentionSearch("");
      setShowMentionDropdown(false);
      setMentionResults([]);
    },
    [onChange, isGroup]
  );

  // Búsqueda de usuarios para menciones (con debounce)
  useEffect(() => {
    if (!mentionSearch) return;
    let cancelled = false;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const q = mentionSearch.toLowerCase();
        const commands = isGroup
          ? SPECIAL_MENTIONS.filter((c: SpecialMention) =>
              c.command.toLowerCase().startsWith(`@${q}`)
            ).map(commandToSuggestion)
          : [];
        const results = await api.searchUsers(mentionSearch, friendsOnly);
        if (!cancelled) {
          const users = results.map((u) => userToSuggestion(u, getInitials));
          const combined = [...commands, ...users];
          setMentionResults(combined);
          setShowMentionDropdown(combined.length > 0);
          setMentionActiveIndex(0);
        }
      } catch (error) {
        console.error("Failed to search users for mentions:", error);
        if (!cancelled) {
          const commands = isGroup
            ? SPECIAL_MENTIONS.filter((c: SpecialMention) =>
                c.command.toLowerCase().startsWith(`@${mentionSearch.toLowerCase()}`)
              ).map(commandToSuggestion)
            : [];
          setMentionResults(commands);
          setShowMentionDropdown(commands.length > 0);
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [mentionSearch, isGroup, friendsOnly]);

  // Seleccionar una mención del dropdown
  const handleSelectMention = useCallback(
    (suggestion: MentionSuggestion) => {
      const atIndex = value.lastIndexOf("@");
      if (atIndex >= 0) {
        const before = value.slice(0, atIndex);
        onChange(`${before}@${suggestion.insertText} `);
      }
      setShowMentionDropdown(false);
      setMentionSearch("");
      setMentionResults([]);
      setMentionActiveIndex(0);
      inputRef.current?.focus();
    },
    [value, onChange]
  );

  const mentionOpen = showMentionDropdown && mentionResults.length > 0;

  const onMentionHover = useCallback((index: number) => {
    setMentionActiveIndex(index);
  }, []);

  const onMentionMove = useCallback((delta: number) => {
    setMentionActiveIndex((i) => {
      const n = mentionResults.length;
      if (n === 0) return 0;
      return (i + delta + n) % n;
    });
  }, [mentionResults.length]);

  const onMentionConfirm = useCallback(() => {
    const picked = mentionResults[mentionActiveIndex];
    if (picked) handleSelectMention(picked);
  }, [mentionResults, mentionActiveIndex, handleSelectMention]);

  const onDismissMentions = useCallback(() => {
    setShowMentionDropdown(false);
    setMentionSearch("");
    setMentionResults([]);
  }, []);

  return {
    mentionResults,
    showMentionDropdown,
    mentionActiveIndex,
    mentionOpen,
    onMentionHover,
    onMentionMove,
    onMentionConfirm,
    onDismissMentions,
    inputRef,
    handleInputChange,
  };
}
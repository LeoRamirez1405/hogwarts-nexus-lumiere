"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import { productsApi } from "@/lib/api/products";
import { SPECIAL_MENTIONS, commandToSuggestion, userToSuggestion, productToSuggestion } from "@/lib/mentions";
import type { MentionSuggestion, SpecialMention } from "@/lib/mentions";
import { getInitials } from "@/app/(main)/messages/helpers";

interface UseMentionsOptions {
  /** Texto actual del input */
  value: string;
  /** Callback cuando cambia el texto */
  onChange: (value: string) => void;
  /** Si es un chat grupal (para mostrar comandos especiales @all, @alle, etc.
   *  y el trigger `!` de elementos de Borgin & Burkes) */
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
  /** Handler para cambios en el textarea (detecta @menciones y !elementos) */
  handleInputChange: (value: string) => void;
}

/** Tipo de trigger activo en este momento — determina qué fetchear y cómo
 *  insertar la sugerencia seleccionada. `null` = ninguno. */
type TriggerKind = "user" | "element" | null;

/**
 * Hook reutilizable para autocompletado de menciones (@usuario, @all, etc.)
 * y, en grupos, de elementos de Borgin & Burkes (!elemento).
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
  /** Trigger activo: `@` para usuarios/comandos, `!` para elementos de Borgin.
   *  Solo se permite `!` en grupos (`isGroup === true`). */
  const triggerKindRef = useRef<TriggerKind>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Detectar "@" o "!" en el input y activar la búsqueda correspondiente.
  const handleInputChange = useCallback(
    (newValue: string) => {
      onChange(newValue);

      // --- Trigger `@` (usuarios / comandos especiales) ---
      const atIndex = newValue.lastIndexOf("@");
      const atValid = atIndex >= 0 && (atIndex === 0 || newValue[atIndex - 1] === " ");

      // --- Trigger `!` (elementos de Borgin & Burkes — solo en grupos) ---
      const exclaimIndex = newValue.lastIndexOf("!");
      const exclaimValid =
        isGroup &&
        exclaimIndex >= 0 &&
        (exclaimIndex === 0 || newValue[exclaimIndex - 1] === " ");

      // El último trigger válido gana.
      if (atValid && (!exclaimValid || atIndex > exclaimIndex)) {
        const query = newValue.slice(atIndex + 1);
        if (!query.includes(" ")) {
          triggerKindRef.current = "user";
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

      if (exclaimValid && (!atValid || exclaimIndex > atIndex)) {
        const query = newValue.slice(exclaimIndex + 1);
        if (!query.includes(" ")) {
          triggerKindRef.current = "element";
          setMentionSearch(query);
          // Con query vacío no mostramos nada todavía — el effect fetcheará
          // productos coincidentes tras el debounce.
          if (query.length === 0) {
            setMentionResults([]);
            setShowMentionDropdown(false);
          }
          return;
        }
      }

      // Ningún trigger válido — limpiar todo.
      triggerKindRef.current = null;
      setMentionSearch("");
      setShowMentionDropdown(false);
      setMentionResults([]);
    },
    [onChange, isGroup]
  );

  // Búsqueda de usuarios para menciones (con debounce) y de elementos de
  // Borgin cuando el trigger es `!`.
  useEffect(() => {
    if (!mentionSearch) return;
    const kind = triggerKindRef.current;
    let cancelled = false;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const q = mentionSearch.toLowerCase();

        if (kind === "element") {
          // --- Búsqueda de elementos de Borgin & Burkes ---
          const page = await productsApi.getProducts(
            "borgin",
            { skip: 0, limit: 20 },
            undefined,
            mentionSearch
          );
          if (!cancelled) {
            const elements = page.items.map(productToSuggestion);
            setMentionResults(elements);
            setShowMentionDropdown(elements.length > 0);
            setMentionActiveIndex(0);
          }
          return;
        }

        // --- Búsqueda de usuarios / comandos especiales ---
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
        console.error("Failed to search for mentions:", error);
        if (!cancelled) {
          if (kind === "element") {
            setMentionResults([]);
            setShowMentionDropdown(false);
          } else {
            const commands = isGroup
              ? SPECIAL_MENTIONS.filter((c: SpecialMention) =>
                  c.command.toLowerCase().startsWith(`@${mentionSearch.toLowerCase()}`)
                ).map(commandToSuggestion)
              : [];
            setMentionResults(commands);
            setShowMentionDropdown(commands.length > 0);
          }
        }
      }
    }, 200);
    return () => {
      cancelled = true;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [mentionSearch, isGroup, friendsOnly]);

  // Seleccionar una mención del dropdown. El formato de inserción depende del
  // trigger: `@nombre` para usuarios, `@comando` para comandos especiales, y
  // `!(Nombre)` para elementos de Borgin.
  const handleSelectMention = useCallback(
    (suggestion: MentionSuggestion) => {
      const trigger = suggestion.kind === "element" ? "!" : "@";
      const triggerIndex = value.lastIndexOf(trigger);
      if (triggerIndex >= 0) {
        const before = value.slice(0, triggerIndex);
        // Si el trigger fue `!`, descartar el texto que el usuario escribió
        // después del `!` (era solo una consulta de búsqueda) y reemplazarlo
        // por la inserción final `!(Nombre)`.
        if (suggestion.kind === "element") {
          onChange(`${before}!(${suggestion.insertText}) `);
        } else {
          onChange(`${before}@${suggestion.insertText} `);
        }
      }
      setShowMentionDropdown(false);
      setMentionSearch("");
      setMentionResults([]);
      setMentionActiveIndex(0);
      triggerKindRef.current = null;
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
    triggerKindRef.current = null;
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
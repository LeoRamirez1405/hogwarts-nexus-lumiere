"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui";
import { MaterialIcon } from "../helpers";
import type { MentionSuggestion } from "@/lib/mentions";

interface MentionDropdownProps {
  results: MentionSuggestion[];
  activeIndex: number;
  onSelect: (suggestion: MentionSuggestion) => void;
  onHover: (index: number) => void;
}

/**
 * Lista de sugerencias de menciones estilo WhatsApp: un panel a todo el ancho
 * anclado justo encima de la barra de input. No usa el caret ni un portal, por
 * lo que se posiciona de forma fiable tanto en desktop como en móvil. Debe
 * renderizarse dentro de un contenedor `relative` que abarque la barra de input.
 * Soporta usuarios reales y comandos especiales (@all, @alle, @alla, @allX).
 */
export default function MentionDropdown({ results, activeIndex, onSelect, onHover }: MentionDropdownProps) {
  const listRef = useRef<HTMLDivElement>(null);

  // Mantener el elemento activo visible al navegar con el teclado.
  useEffect(() => {
    const item = listRef.current?.querySelector<HTMLElement>(`[data-mention-index="${activeIndex}"]`);
    item?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (results.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="absolute bottom-full left-0 right-0 mb-2 z-50 max-h-60 overflow-y-auto no-scrollbar rounded-2xl bg-surface-container-highest border border-outline-variant/30 shadow-2xl glass-card py-1"
      role="listbox"
      aria-label="Sugerencias de menciones"
    >
      {results.map((s, idx) => (
        <button
          key={s.id}
          type="button"
          data-mention-index={idx}
          // preventDefault en mousedown para que el textarea no pierda el foco
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onSelect(s)}
          onMouseEnter={() => onHover(idx)}
          className={`flex items-center gap-3 px-3 py-2 w-full text-left transition-colors ${
            idx === activeIndex ? "bg-surface-container-high" : "hover:bg-surface-container-high"
          }`}
          role="option"
          aria-selected={idx === activeIndex}
        >
          {s.kind === "command" ? (
            <>
              <span className="w-9 h-9 flex items-center justify-center rounded-full bg-secondary/10 text-secondary shrink-0">
                <MaterialIcon
                  name={s.icon ?? "groups"}
                  className={`text-lg ${
                    s.id === "allg"
                      ? "text-red-600"
                      : s.id === "alls"
                        ? "text-green-600"
                        : s.id === "allh"
                          ? "text-yellow-600"
                          : s.id === "allr"
                            ? "text-blue-600"
                            : ""
                  }`}
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-on-surface truncate text-body-md">
                  <span className="font-mono text-secondary font-semibold">{s.label}</span>
                </p>
                <p className="text-label-sm text-on-surface-variant truncate">{s.sublabel}</p>
              </div>
            </>
          ) : (
            <>
              <Avatar src={s.avatarUrl} alt={s.label} size="sm" initials={s.initials} />
              <div className="min-w-0">
                <p className="font-medium text-on-surface truncate text-body-md">{s.label}</p>
                {s.sublabel && <p className="text-label-sm text-on-surface-variant truncate">{s.sublabel}</p>}
              </div>
            </>
          )}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui";
import { getInitials } from "../helpers";
import { FloatingPopover } from "./FloatingPopover";
import { useCaretPosition } from "./ChatInput/hooks/useCaretPosition";
import type { UserSearchResult } from "@/lib/api";
import type { CaretCoords } from "./ChatInput/hooks/useCaretPosition";

interface MentionDropdownProps {
  results: UserSearchResult[];
  onSelect: (name: string) => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}

export default function MentionDropdown({ results, onSelect, anchorRef }: MentionDropdownProps) {
  const open = results.length > 0;
  const textareaRef = anchorRef as React.RefObject<HTMLTextAreaElement | null>;
  const { getCaretCoords } = useCaretPosition(textareaRef);
  const [caretCoords, setCaretCoords] = useState<CaretCoords | null>(null);
  const prevCoordsRef = useRef<CaretCoords | null>(null);

  useEffect(() => {
    if (!open) return;
    const coords = getCaretCoords();
    if (coords && (prevCoordsRef.current?.x !== coords.x || prevCoordsRef.current?.y !== coords.y)) {
      prevCoordsRef.current = coords;
      setCaretCoords(coords);
    }
  }, [open, getCaretCoords, results.length]);

  const content = (
    <div className="py-1">
      {results.map((u) => (
        <button
          key={u.id}
          onClick={() => onSelect(u.name)}
          className="flex items-center gap-3 px-3 py-2 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
        >
          <Avatar src={u.avatar_url} alt={u.name} size="sm" initials={getInitials(u.name)} />
          <div>
            <p className="font-medium">{u.name}</p>
            {u.house && <p className="text-label-sm text-on-surface-variant">{u.house}</p>}
          </div>
        </button>
      ))}
    </div>
  );

  if (!open) return null;

  return (
    <FloatingPopover
      clientX={caretCoords?.x}
      clientY={caretCoords?.y}
      lineHeight={caretCoords?.lineHeight}
      open={open}
      onRequestClose={() => {}}
      placement="bottom"
      align="start"
      gap={4}
      maxHeight={200}
      className="w-64"
    >
      {content}
    </FloatingPopover>
  );
}
"use client";

import { Avatar } from "@/components/ui";
import { getInitials } from "../helpers";
import { FloatingPopover } from "./FloatingPopover";
import type { UserSearchResult } from "@/lib/api";

interface MentionDropdownProps {
  results: UserSearchResult[];
  onSelect: (name: string) => void;
  anchorRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
}

export default function MentionDropdown({
  results,
  onSelect,
  anchorRef,
}: MentionDropdownProps) {
  const open = results.length > 0;

  const content = (
    <div className="py-1">
      {results.map((u) => (
        <button
          key={u.id}
          onClick={() => onSelect(u.name)}
          className="flex items-center gap-3 px-3 py-2 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
        >
          <Avatar
            src={u.avatar_url}
            alt={u.name}
            size="sm"
            initials={getInitials(u.name)}
          />
          <div>
            <p className="font-medium">{u.name}</p>
            {u.house && (
              <p className="text-label-sm text-on-surface-variant">{u.house}</p>
            )}
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <FloatingPopover
      anchorRef={anchorRef}
      open={open}
      onRequestClose={() => {}}
      placement="top"
      align="start"
      gap={4}
      maxHeight={200}
      className="w-64"
    >
      {content}
    </FloatingPopover>
  );
}
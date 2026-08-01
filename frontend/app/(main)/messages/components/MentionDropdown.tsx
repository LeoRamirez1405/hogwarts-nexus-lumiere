"use client";

import { Avatar } from "@/components/ui";
import { getInitials } from "../helpers";
import type { UserSearchResult } from "@/lib/api";

interface MentionDropdownProps {
  results: UserSearchResult[];
  onSelect: (name: string) => void;
}

export default function MentionDropdown({ results, onSelect }: MentionDropdownProps) {
  return (
    <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface-container-highest rounded-xl shadow-xl py-1 z-30 max-h-48 overflow-y-auto">
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
}

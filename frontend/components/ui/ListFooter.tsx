"use client";

import { MaterialIcon } from "./MaterialIcon";

interface ListFooterProps {
  expanded: boolean;
  hasMore: boolean;
  remaining: number;
  total: number;
  onToggle: () => void;
}

export default function ListFooter({
  expanded,
  hasMore,
  remaining,
  total,
  onToggle,
}: ListFooterProps) {
  if (!hasMore) return null;

  return (
    <div className="flex items-center justify-center pt-4">
      <button
        onClick={onToggle}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest text-label-sm font-medium transition-all active:scale-95"
      >
        <MaterialIcon
          name={expanded ? "expand_less" : "expand_more"}
          className="text-lg"
        />
        {expanded
          ? "Ver menos"
          : `Ver ${remaining} más`}
        <span className="text-on-surface-variant/60">
          ({total} en total)
        </span>
      </button>
    </div>
  );
}

"use client";

import { MaterialIcon } from "./MaterialIcon";

interface ListFooterProps {
  hasMore: boolean;
  loading: boolean;
  pageSize: number;
  /** Items currently loaded in memory. */
  loaded: number;
  /** Total items available in the database. */
  total: number;
  onLoadMore: () => void;
}

export default function ListFooter({
  hasMore,
  loading,
  pageSize,
  loaded,
  total,
  onLoadMore,
}: ListFooterProps) {
  if (!hasMore) return null;

  const remaining = Math.max(0, total - loaded);
  const next = remaining > 0 ? Math.min(pageSize, remaining) : pageSize;

  return (
    <div className="flex items-center justify-center pt-4">
      {loading ? (
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-label-sm text-on-surface-variant/60">
          <MaterialIcon name="progress_activity" className="text-lg animate-spin" />
          Cargando...
        </span>
      ) : (
        <button
          onClick={onLoadMore}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest text-label-sm font-medium transition-all active:scale-95"
        >
          <MaterialIcon name="expand_more" className="text-lg" />
          Cargar {next} más
          <span className="text-on-surface-variant/60">
            ({loaded} de {total})
          </span>
        </button>
      )}
    </div>
  );
}

"use client";

import { useMemo } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useHapticLight } from "@/hooks/useHapticFeedback";

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  className?: string;
  hideOnMobile?: boolean;
  hideOnTablet?: boolean;
}

export interface AdminCrudTableProps<T> {
  items: T[];
  columns: ColumnDef<T>[];
  onEdit: (item: T) => void;
  onDelete: (id: string) => void;
  getId: (item: T) => string;
  loading?: boolean;
  emptyMessage?: string;
  emptyIcon?: string;
  hasMore?: boolean;
  loadingMore?: boolean;
  totalLoaded?: number;
  totalCount?: number;
  onLoadMore?: () => Promise<void>;
  className?: string;
}

export function AdminCrudTable<T>({
  items,
  columns,
  onEdit,
  onDelete,
  getId,
  loading = false,
  emptyMessage = "No se encontraron elementos",
  emptyIcon = "inbox",
  hasMore,
  loadingMore,
  totalLoaded,
  totalCount,
  onLoadMore,
  className = "",
}: AdminCrudTableProps<T>) {
  const visibleColumns = useMemo(
    () => columns.filter((c) => !c.hideOnMobile),
    [columns]
  );
  const desktopColumns = useMemo(
    () => columns.filter((c) => !c.hideOnTablet),
    [columns]
  );
  const hapticLight = useHapticLight();

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-full bg-outline-variant/30" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-outline-variant/30 rounded w-1/3" />
                <div className="h-3 bg-outline-variant/30 rounded w-1/4" />
              </div>
              <div className="h-5 bg-outline-variant/30 rounded w-16" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <MaterialIcon name={emptyIcon} className="text-5xl text-outline-variant mb-3 block mx-auto" />
        <p className="text-on-surface-variant text-body-md">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* MOBILE: Cards */}
      <div className="md:hidden divide-y divide-outline-variant/10">
        {items.map((item) => (
          <div key={getId(item)} className="p-4 hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/10 last:border-0">
            <div className="space-y-2">
              {visibleColumns.map((col) => (
                <div key={col.key} className="flex items-center gap-3">
                  <span className="text-label-sm text-on-surface-variant w-24 shrink-0">{col.header}</span>
                  <div className="flex-1 min-w-0">{col.render(item)}</div>
                </div>
              ))}
              <div className="flex items-center justify-end gap-1 pt-2 border-t border-outline-variant/10">
                <button onClick={() => { hapticLight(); onEdit(item); }} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors" title="Editar">
                  <MaterialIcon name="edit" className="text-lg" />
                </button>
                <button onClick={() => { hapticLight(); onDelete(getId(item)); }} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                  <MaterialIcon name="delete" className="text-lg" />
                </button>
              </div>
            </div>
          </div>
        ))}
        {hasMore && onLoadMore && (
          <div className="p-2 text-center">
            <button onClick={onLoadMore} disabled={loadingMore} className="text-primary text-label-sm font-medium hover:underline disabled:opacity-50">
              {loadingMore ? "Cargando..." : `Cargar más (${totalLoaded}/${totalCount})`}
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface-container">
            <tr className="border-b border-outline-variant/20">
              {desktopColumns.map((col) => (
                <th key={col.key} className={`text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium ${col.className ?? ""}`}>
                  {col.header}
                </th>
              ))}
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right pr-6">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={getId(item)} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                {desktopColumns.map((col) => (
                  <td key={col.key} className={`px-6 py-4 ${col.className ?? ""}`}>
                    {col.render(item)}
                  </td>
                ))}
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => { hapticLight(); onEdit(item); }} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors" title="Editar">
                      <MaterialIcon name="edit" className="text-lg" />
                    </button>
                    <button onClick={() => { hapticLight(); onDelete(getId(item)); }} className="p-2 rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                      <MaterialIcon name="delete" className="text-lg" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {hasMore && onLoadMore && (
          <div className="p-2 text-center">
            <button onClick={onLoadMore} disabled={loadingMore} className="text-primary text-label-sm font-medium hover:underline disabled:opacity-50">
              {loadingMore ? "Cargando..." : `Cargar más (${totalLoaded}/${totalCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
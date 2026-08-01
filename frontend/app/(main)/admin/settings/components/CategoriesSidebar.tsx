"use client";

import { EnumCategory } from "@/lib/api";
import { Button, ListFooter, MaterialIcon } from "@/components/ui";
import { CATEGORY_ICONS } from "../constants";

interface CategoriesSidebarProps {
  items: EnumCategory[];
  activeId: string | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
  hasMore: boolean;
  loadingMore: boolean;
  totalLoaded: number;
  totalCount: number;
  onLoadMore: () => Promise<void>;
}

export function CategoriesSidebar({
  items,
  activeId,
  search,
  onSearchChange,
  onSelect,
  onNew,
  hasMore,
  loadingMore,
  totalLoaded,
  totalCount,
  onLoadMore,
}: CategoriesSidebarProps) {
  return (
    <div className="glass-card rounded-xl flex flex-col lg:col-span-1">
      <div className="p-4 border-b border-outline-variant/20">
        <h2 className="font-display text-title-md text-on-surface">Categorías</h2>
      </div>
      <div className="p-2">
        <input
          type="text"
          placeholder="Buscar categorías..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors mb-4"
        />
        <Button variant="primary" icon="add" size="sm" onClick={onNew} className="w-full mb-4">
          Nueva Categoría
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {items.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`w-full text-left p-3 rounded-xl transition-all ${
              activeId === c.id
                ? "bg-primary/10 text-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <div className="flex items-center gap-3">
              <MaterialIcon name={CATEGORY_ICONS[c.code] || "category"} className="text-xl" />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-body-md truncate">{c.name}</p>
                <p className="text-label-sm text-on-surface-variant truncate">{c.code}</p>
              </div>
              <span className="text-label-sm text-on-surface-variant">
                {c.values.length} valores
              </span>
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <div className="p-8 text-center">
            <MaterialIcon name="category" className="text-4xl text-outline-variant mb-2 block mx-auto" />
            <p className="text-on-surface-variant text-body-md">No se encontraron categorías</p>
          </div>
        )}
      </div>
      <div className="p-2 border-t border-outline-variant/20">
        <ListFooter
          hasMore={hasMore}
          loading={loadingMore}
          pageSize={10}
          loaded={totalLoaded}
          total={totalCount}
          onLoadMore={onLoadMore}
        />
      </div>
    </div>
  );
}

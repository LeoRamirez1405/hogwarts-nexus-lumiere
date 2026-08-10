"use client";

import { useState } from "react";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { api, Catalog } from "@/lib/api";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebounce } from "@/hooks/useDebounce";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import GlassCard from "@/components/ui/GlassCard";
import ListFooter from "@/components/ui/ListFooter";
import EmptyState from "@/components/ui/EmptyState";
import SearchBar from "@/components/ui/SearchBar";
import { MaterialIcon, Skeleton, DetailModal } from "@/components/ui";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { CatalogDetailContent } from "@/components/domain/Catalogs/CatalogDetailContent";
import { useRouter } from "next/navigation";

function CatalogCard({
  catalog,
  onSelect,
}: {
  catalog: Catalog;
  onSelect: (catalog: Catalog) => void;
}) {
  const router = useRouter();
  const theme = useTheme();
  const [src, setSrc] = useState<string>(
    catalog.cover_image_url || getFallbackImageByContext("generic", theme)
  );

  const handleImageError = () => {
    const fallback = getFallbackImageByContext("generic", theme);
    if (src !== fallback) setSrc(fallback);
  };

  return (
    <GlassCard
      hover
      className="overflow-hidden cursor-pointer group p-5"
      onClick={() => router.push(`/catalogs/${catalog.id}`)}
    >
      <div className="relative h-40 rounded-2xl overflow-hidden mb-4">
        <Image
          src={src}
          alt={catalog.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized={isStoredUpload(src)}
          onError={handleImageError}
        />
        <span className="absolute top-3 right-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm flex items-center gap-1">
          <MaterialIcon name="grid_view" className="text-[1em]" />
          {catalog.item_count}
        </span>
      </div>
      <h3 className="font-display text-headline-lg text-primary mb-1 line-clamp-1">
        {catalog.name}
      </h3>
      <p className="text-body-md text-on-surface-variant line-clamp-2">
        {catalog.description || "Sin descripción"}
      </p>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onSelect(catalog);
        }}
        className="inline-flex items-center gap-1 text-label-sm font-bold text-secondary mt-3 hover:underline"
      >
        Ver detalle
        <MaterialIcon name="chevron_right" className="text-base" />
      </button>
    </GlassCard>
  );
}

export default function CatalogsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [detailCatalog, setDetailCatalog] = useState<Catalog | null>(null);

  const {
    items: catalogs,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
  } = usePaginatedList<Catalog>({
    fetcher: (p) => api.getCatalogs(p, debouncedSearch || undefined),
    pageSize: 12,
    enabled: true,
    queryKey: ["catalogs", "user"],
    resetKey: debouncedSearch,
  });

  const filtered = catalogs;

  const handleExplore = (catalog: Catalog) => {
    setDetailCatalog(null);
    router.push(`/catalogs/${catalog.id}`);
  };

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-2 mb-6">
          <h1 className="font-display text-headline-lg md:text-display-lg text-primary">
            Catálogos
          </h1>
          <p className="text-body-md text-on-surface-variant">
            Explora los catálogos disponibles. Cuando pidas algo en Flourish &
            Blotts, indica en la especificación el catálogo y el número del
            elemento que quieres.
          </p>
        </div>

        <div className="mb-6 max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Buscar catálogo..."
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card rounded-3xl p-5">
                <Skeleton className="h-40 rounded-2xl mb-4" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon="collections_bookmark"
            title={
              search ? "Sin resultados" : "Aún no hay catálogos"
            }
            description={
              search
                ? `No se encontró ningún catálogo con "${search}".`
                : "Vuelve pronto, los catálogos se publicarán aquí."
            }
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((catalog) => (
              <CatalogCard
                key={catalog.id}
                catalog={catalog}
                onSelect={setDetailCatalog}
              />
            ))}
          </div>
        )}

        {!search && (
          <ListFooter
            hasMore={hasMore}
            loading={loadingMore}
            pageSize={12}
            loaded={totalLoaded}
            total={totalCount}
            onLoadMore={loadMore}
          />
        )}
      </div>

      {/* Catalog Detail Modal (Modal en desktop, BottomSheet en mobile) */}
      <DetailModal
        open={!!detailCatalog}
        onClose={() => setDetailCatalog(null)}
        title={detailCatalog?.name}
        size="md"
      >
        {detailCatalog && (
          <CatalogDetailContent
            catalog={detailCatalog}
            onExplore={handleExplore}
          />
        )}
      </DetailModal>
    </PullToRefresh>
  );
}

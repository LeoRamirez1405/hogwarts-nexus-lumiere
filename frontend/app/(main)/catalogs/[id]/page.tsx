"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient, InfiniteData } from "@tanstack/react-query";
import { api, CatalogItem } from "@/lib/api";
import { Page } from "@/lib/api";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import GlassCard from "@/components/ui/GlassCard";
import ListFooter from "@/components/ui/ListFooter";
import EmptyState from "@/components/ui/EmptyState";
import Switch from "@/components/ui/Switch";
import { MaterialIcon, Skeleton, DetailModal } from "@/components/ui";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { CatalogItemCard } from "@/components/domain/Catalogs/CatalogItemCard";
import { CatalogItemDetailContent } from "@/components/domain/Catalogs/CatalogItemDetailContent";
import { toastError } from "@/lib/toastStore";

export default function CatalogDetailPage() {
  const params = useParams<{ id: string }>();
  const catalogId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const theme = useTheme();
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["catalog", catalogId],
    queryFn: () => api.getCatalog(catalogId),
    enabled: !!catalogId,
  });

  const {
    items,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
  } = usePaginatedList<CatalogItem>({
    fetcher: (p) => api.getCatalogItems(catalogId, p, onlyFavorites),
    pageSize: 12,
    enabled: !!catalogId,
    queryKey: ["catalog-items", catalogId],
    resetKey: onlyFavorites,
  });

  const patchFavorite = useCallback(
    (itemId: string, next: boolean) => {
      queryClient.setQueryData<InfiniteData<Page<CatalogItem>>>(
        ["catalog-items", catalogId, onlyFavorites],
        (old) =>
          old
            ? {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  items: p.items.map((i) =>
                    i.id === itemId ? { ...i, is_favorite: next } : i
                  ),
                })),
              }
            : old
      );
    },
    [catalogId, onlyFavorites, queryClient]
  );

  const handleToggleFavorite = useCallback(
    async (item: CatalogItem) => {
      const next = !item.is_favorite;
      patchFavorite(item.id, next);
      try {
        await api.toggleItemFavorite(item.id);
        if (onlyFavorites) refresh();
      } catch (e) {
        patchFavorite(item.id, !next);
        toastError("No se pudo actualizar el favorito", e);
      }
    },
    [patchFavorite, onlyFavorites, refresh]
  );

  const fallbackSrc = getFallbackImageByContext("generic", theme);
  const [imgError, setImgError] = useState(false);
  const src =
    !imgError && catalog?.cover_image_url
      ? catalog.cover_image_url
      : fallbackSrc;

  const handleImageError = () => {
    setImgError(true);
  };

  // Live item lookup so the detail modal always reflects the current
  // favorite state (and closes if the item leaves the "favorites only" view).
  const detailItem =
    items.find((i) => i.id === detailItemId) ?? null;

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="p-4 md:p-8 max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/catalogs")}
          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-sm font-medium mb-4 transition-colors"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          Volver a catálogos
        </button>

        {catalogLoading || !catalog ? (
          <div className="glass-card rounded-3xl p-6 mb-6">
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <GlassCard className="overflow-hidden mb-6">
            <div className="flex flex-col md:flex-row gap-6 p-6">
              <div className="relative w-full md:w-64 h-44 md:h-44 rounded-2xl overflow-hidden shrink-0">
                <Image
                  src={src}
                  alt={catalog.name}
                  fill
                  className="object-cover"
                  unoptimized={
                    src.startsWith("http://localhost:8000/uploads/") ||
                    src.startsWith("/fallbacks/")
                  }
                  onError={handleImageError}
                />
              </div>
              <div className="flex-1">
                <h1 className="font-display text-headline-lg md:text-display-lg text-primary mb-2">
                  {catalog.name}
                </h1>
                <p className="text-body-md text-on-surface-variant mb-4">
                  {catalog.description || "Sin descripción"}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1 text-label-sm font-bold text-secondary">
                    <MaterialIcon name="grid_view" className="text-base" />
                    {catalog.item_count} elementos
                  </span>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-headline-md text-primary">
            {onlyFavorites ? "Mis favoritos" : "Elementos"}
          </h2>
          <Switch
            checked={onlyFavorites}
            onChange={setOnlyFavorites}
            label="Solo favoritos"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="glass-card rounded-3xl overflow-hidden">
                <Skeleton className="h-56 w-full" />
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={onlyFavorites ? "favorite_border" : "grid_view"}
            title={onlyFavorites ? "Sin favoritos" : "Catálogo vacío"}
            description={
              onlyFavorites
                ? "Marca el corazón en un elemento para verlo aquí."
                : "Este catálogo aún no tiene elementos."
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
              {items.map((item) => (
                <CatalogItemCard
                  key={item.id}
                  item={item}
                  onToggleFavorite={handleToggleFavorite}
                  onSelect={(i) => setDetailItemId(i.id)}
                />
              ))}
            </div>
            <ListFooter
              hasMore={hasMore}
              loading={loadingMore}
              pageSize={12}
              loaded={totalLoaded}
              total={totalCount}
              onLoadMore={loadMore}
            />
          </>
        )}
      </div>

      {/* Item Detail Modal (Modal en desktop, BottomSheet en mobile) */}
      <DetailModal
        open={!!detailItem}
        onClose={() => setDetailItemId(null)}
        title={detailItem ? `Elemento #${detailItem.numero}` : undefined}
        size="md"
      >
        {detailItem && (
          <CatalogItemDetailContent
            item={detailItem}
            onToggleFavorite={handleToggleFavorite}
          />
        )}
      </DetailModal>
    </PullToRefresh>
  );
}

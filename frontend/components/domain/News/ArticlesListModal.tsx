"use client";

import { MaterialIcon } from "@/components/ui";
import { GlassCard, Button, SearchBar, Modal, BottomSheet } from "@/components/ui";
import { useArticlesList } from "@/hooks/useArticlesList";
import { VirtualizedArticleGrid } from "@/components/domain/News";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface ArticlesListModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ArticlesListModal({ isOpen, onClose }: ArticlesListModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
  const {
    articles,
    loading,
    loadingMore,
    hasMore,
    search,
    setSearch,
    category,
    setCategory,
    featuredOnly,
    setFeaturedOnly,
    categories,
    loadMore,
  } = useArticlesList({
    initialSearch: "",
    initialCategory: "",
    initialFeaturedOnly: false,
    pageSize: 20,
    enabled: isOpen,
  });

  const renderFilters = () => (
    <div className="flex flex-col sm:flex-row gap-4 mb-4">
      <div className="flex-1">
        <SearchBar
          placeholder="Buscar por título, contenido..."
          value={search}
          onChange={setSearch}
          size="md"
        />
      </div>
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="w-full sm:w-48 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:outline-none focus:ring-2 focus:ring-primary text-body-md appearance-none"
      >
        <option value="">Todas las categorías</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setFeaturedOnly(!featuredOnly)}
        aria-pressed={featuredOnly}
        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
          featuredOnly
            ? "bg-secondary text-on-secondary shadow-[0_0_16px_rgba(119,90,25,0.35)]"
            : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
        }`}
      >
        <MaterialIcon name="star" className="text-[1.1em]" filled={featuredOnly} />
        Destacados
      </button>
    </div>
  );

  const renderGrid = () => (
    <div className={isDesktop ? "flex-1 overflow-y-auto" : ""}>
      {loading && articles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <MaterialIcon
            name="progress_activity"
            className="text-5xl text-outline-variant animate-spin mb-3"
          />
          <p className="text-on-surface-variant text-body-md">
            Cargando ediciones...
          </p>
        </div>
      ) : articles.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <MaterialIcon
            name="article"
            className="text-5xl text-outline-variant mb-3"
          />
          <p className="text-on-surface-variant text-body-md">
            No se encontraron ediciones
          </p>
          <p className="text-on-surface-variant/60 text-label-sm mt-1">
            Intenta con otros términos de búsqueda
          </p>
        </GlassCard>
      ) : (
        <>
          <div className={isDesktop ? "h-[calc(100dvh-18rem)] min-h-72" : "h-[55dvh] min-h-64"}>
            <VirtualizedArticleGrid
              articles={articles}
              columns={3}
              itemHeight={280}
              gap={16}
              useWindowScroll={false}
            />
          </div>

          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                size="md"
                icon="expand_more"
                iconPosition="right"
                onClick={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? "Cargando..." : "Cargar más"}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Modal open={isOpen} onClose={onClose} size="lg" title="Todas las ediciones">
        <div className="flex flex-col h-full">
          {renderFilters()}
          {renderGrid()}
        </div>
      </Modal>
    );
  }

  return (
    <BottomSheet open={isOpen} onClose={onClose} title="Todas las ediciones">
      {renderFilters()}
      {renderGrid()}
    </BottomSheet>
  );
}
"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { GlassCard, Button, SearchBar } from "@/components/ui";
import { useArticlesList } from "@/hooks/useArticlesList";
import { VirtualizedArticleGrid } from "@/components/domain/News";

export default function NewsAllPage() {
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
    pageSize: 12,
    enabled: true,
  });

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Link
            href="/news"
            className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary transition-colors mb-2"
          >
            <MaterialIcon name="arrow_back" className="text-[1.1em]" />
            Volver al Quisquilloso
          </Link>
          <h1 className="font-display text-headline-lg-mobile md:text-display-lg text-on-surface">
            Todas las Ediciones
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Explora todo el archivo del Quisquilloso
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <GlassCard className="p-5">
        <form className="space-y-4">
          <SearchBar
            placeholder="Buscar por título, contenido, autor..."
            value={search}
            onChange={setSearch}
            size="md"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCategory("")}
              className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                category === "" || category === "all"
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              Todas
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                  category === cat
                    ? "bg-secondary-container text-on-secondary-container"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Extra filter: destacados (combinable con la categoría) */}
          <div className="flex flex-wrap items-center gap-3 border-t border-outline-variant/20 pt-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Filtrar
            </span>
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
            {featuredOnly && (
              <span className="text-label-sm text-on-surface-variant">
                Mostrando solo destacados{category && category !== "all" ? ` en ${category}` : ""}
              </span>
            )}
          </div>
        </form>
      </GlassCard>

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <GlassCard key={i} className="p-6 animate-pulse">
              <div className="h-40 bg-surface-container-high rounded-xl mb-4" />
              <div className="h-4 bg-surface-container-high rounded w-3/4 mb-2" />
              <div className="h-4 bg-surface-container-high rounded w-1/2" />
            </GlassCard>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <MaterialIcon name="search_off" className="text-5xl text-outline-variant mb-3" />
          <p className="text-on-surface-variant text-body-md">
            No se encontraron artículos
          </p>
          <p className="text-on-surface-variant/60 text-label-sm mt-1">
            Intenta con otros términos de búsqueda
          </p>
        </GlassCard>
      ) : (
        <>
          <VirtualizedArticleGrid
            articles={articles}
            columns={3}
            itemHeight={320}
            gap={24}
          />

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" size="lg" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? (
                  <>
                    <MaterialIcon name="progress_activity" className="text-[1.1em] animate-spin mr-2" />
                    Cargando...
                  </>
                ) : (
                  "Cargar más"
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { GlassCard, Badge, Button, SearchBar } from "@/components/ui";
import { api, Article } from "@/lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function NewsAllPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 12;

  const fetchCategories = useCallback(async () => {
    try {
      const data = await api.getArticleCategories();
      setCategories(data);
    } catch {
      setCategories([]);
    }
  }, []);

  const fetchArticles = useCallback(
    async (pageNum = 1, append = false) => {
      setLoading(true);
      try {
        const params: Record<string, string> = {
          limit: String(PAGE_SIZE),
          offset: String((pageNum - 1) * PAGE_SIZE),
        };
        if (search) params.search = search;
        if (category !== "all" && category) params.category = category;
        const data = await api.getArticles(params);
        if (append) {
          setArticles((prev) => [...prev, ...data]);
        } else {
          setArticles(data);
        }
        setHasMore(data.length === PAGE_SIZE);
        setPage(pageNum);
      } catch {
        if (!append) setArticles([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [search, category, PAGE_SIZE]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCategories();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchArticles(1, false);
  }, []);

  const handleLoadMore = () => {
    fetchArticles(page + 1, true);
  };

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
              onClick={() => setCategory("all")}
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {articles.map((article) => (
              <Link key={article.id} href={`/news/${article.id}`} className="block">
                <GlassCard className="p-5 h-full parchment-texture" hover glow>
                  {article.image_url && (
                    <div className="relative h-40 rounded-xl overflow-hidden mb-4">
                      <img
                        src={article.image_url}
                        alt={article.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="mb-3">
                    <Badge variant="tag" color="secondary">
                      {article.category}
                    </Badge>
                  </div>
                  <h2 className="font-display text-body-md text-on-surface leading-snug mb-2 line-clamp-2">
                    {article.title}
                  </h2>
                  <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
                    {article.body.slice(0, 120)}...
                  </p>
                  <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                    <span>{formatDate(article.created_at)}</span>
                    <Button variant="ghost" size="sm" icon="arrow_forward" iconPosition="right">
                      Leer
                    </Button>
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <Button variant="outline" size="lg" onClick={handleLoadMore} disabled={loading}>
                {loading ? (
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
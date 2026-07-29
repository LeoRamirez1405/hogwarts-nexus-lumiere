"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { GlassCard, Badge, Button, SearchBar, Modal } from "@/components/ui";
import { api, Article } from "@/lib/api";

interface ArticlesListModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialArticles?: Article[];
}

export function ArticlesListModal({ isOpen, onClose, initialArticles }: ArticlesListModalProps) {
  const [articles, setArticles] = useState<Article[]>(initialArticles || []);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("");
  const [categories, setCategories] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const pageRef = useRef(0);
  const PAGE_SIZE = 20;

  const loadArticles = useCallback(
    async (reset: boolean) => {
      setLoading(true);
      try {
        const nextPage = reset ? 0 : pageRef.current;
        const params: Record<string, string> = {
          limit: PAGE_SIZE.toString(),
          offset: (nextPage * PAGE_SIZE).toString(),
        };
        if (search) params.search = search;
        if (category) params.category = category;

        const newArticles = await api.getArticles(params);

        if (reset) {
          setArticles(newArticles);
        } else {
          setArticles((prev) => [...prev, ...newArticles]);
        }

        setHasMore(newArticles.length === PAGE_SIZE);
        pageRef.current = nextPage + 1;
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    },
    [search, category]
  );

  // Load categories once on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cats = await api.getArticleCategories();
        if (mounted) setCategories(cats);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Reload articles when modal opens or search/category changes
  useEffect(() => {
    if (!isOpen) return;
    pageRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArticles(initialArticles || []);
    loadArticles(true);
  }, [isOpen, initialArticles, loadArticles]);

  useEffect(() => {
    if (!isOpen) return;
    pageRef.current = 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadArticles(true);
  }, [search, category, isOpen, loadArticles]);

  const handleLoadMore = () => loadArticles(false);

  return (
    <Modal open={isOpen} onClose={onClose} size="lg" title="Todas las ediciones">
      <div className="flex flex-col h-full">
        {/* Search & Filters */}
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
        </div>

        {/* Articles Grid */}
        <div className="flex-1 overflow-y-auto">
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                {articles.map((a) => (
                  <Link key={a.id} href={`/news/${a.id}`} className="block" onClick={onClose}>
                    <GlassCard className="p-4 h-full" hover>
                      <div className="mb-2 flex flex-wrap gap-1">
                        <Badge variant="tag" color="secondary">
                          {a.category}
                        </Badge>
                        {a.featured && (
                          <Badge variant="rarity" color="primary">
                            Destacado
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-display text-body-md text-on-surface leading-snug line-clamp-3 mb-2">
                        {a.title}
                      </h3>
                      <p className="text-label-sm text-on-surface-variant">
                        {new Date(a.created_at).toLocaleDateString("es-ES", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </GlassCard>
                  </Link>
                ))}
              </div>

              {hasMore && (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    size="md"
                    icon="expand_more"
                    iconPosition="right"
                    onClick={handleLoadMore}
                    disabled={loading}
                  >
                    {loading ? "Cargando..." : "Cargar más"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
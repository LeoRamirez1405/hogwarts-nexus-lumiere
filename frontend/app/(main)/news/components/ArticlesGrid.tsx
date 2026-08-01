"use client";

import { useRouter } from "next/navigation";
import { Article } from "@/lib/api";
import { Button, GlassCard, ListFooter, MaterialIcon } from "@/components/ui";
import { VirtualizedArticleGrid } from "@/components/domain/News";
import { SectionLoading } from "./SectionLoading";

interface ArticlesGridProps {
  articles: Article[];
  filter: "recent" | "featured";
  onFilterChange: (filter: "recent" | "featured") => void;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  totalCount: number;
  onLoadMore: () => Promise<void>;
}

export function ArticlesGrid({
  articles,
  filter,
  onFilterChange,
  loading,
  loadingMore,
  hasMore,
  total,
  totalCount,
  onLoadMore,
}: ArticlesGridProps) {
  const router = useRouter();
  const isFeatured = filter === "featured";

  return (
    <div className="hidden md:block">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-headline-lg text-on-surface flex items-center gap-3">
          <MaterialIcon name="auto_stories" className="text-primary" filled />
          Ediciones Recientes
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFilterChange("recent")}
            className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
              filter === "recent"
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Recientes
          </button>
          <button
            onClick={() => onFilterChange("featured")}
            className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
              filter === "featured"
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Destacadas
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/news/all")}
            className="text-primary font-medium"
          >
            Ver todos
          </Button>
        </div>
      </div>
      {articles.length === 0 && loading ? (
        <SectionLoading className="py-16" />
      ) : articles.length === 0 && !loading ? (
        <GlassCard className="p-12 text-center">
          <MaterialIcon
            name={isFeatured ? "star" : "article"}
            className="text-5xl text-outline-variant mb-3"
          />
          <p className="text-on-surface-variant text-body-md">
            {isFeatured
              ? "Aún no hay artículos destacados"
              : "Aún no hay ediciones disponibles"}
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
          <ListFooter
            hasMore={hasMore}
            loading={loadingMore}
            pageSize={9}
            loaded={total}
            total={totalCount}
            onLoadMore={onLoadMore}
          />
        </>
      )}
    </div>
  );
}

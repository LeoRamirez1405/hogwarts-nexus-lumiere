"use client";

import Image from "next/image";
import Link from "next/link";
import { Article } from "@/lib/api";
import { Badge, GlassCard, ListFooter, MaterialIcon } from "@/components/ui";
import { VirtualizedArticleGrid } from "@/components/domain/News";
import { SectionLoading } from "./SectionLoading";
import { isLocalUpload } from "../utils";

interface SavedArticlesSectionProps {
  articles: Article[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  total: number;
  totalCount: number;
  onLoadMore: () => Promise<void>;
  onToggleSubscribe: (id: string) => void;
}

export function SavedArticlesSection({
  articles,
  loading,
  loadingMore,
  hasMore,
  total,
  totalCount,
  onLoadMore,
  onToggleSubscribe,
}: SavedArticlesSectionProps) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-headline-lg text-on-surface flex items-center gap-3">
        <MaterialIcon name="bookmark" className="text-secondary" filled />
        Artículos Guardados
      </h2>
      {loading ? (
        <SectionLoading />
      ) : articles.length === 0 ? (
        <GlassCard className="p-12 text-center">
          <MaterialIcon
            name="bookmark_border"
            className="text-5xl text-outline-variant mb-3"
          />
          <p className="text-on-surface-variant text-body-md mb-2">
            No tienes artículos guardados aún.
          </p>
          <p className="text-on-surface-variant text-body-sm">
            Usa el botón de guardar en cualquier artículo para verlo aquí.
          </p>
        </GlassCard>
      ) : (
        <>
          <VirtualizedArticleGrid
            articles={articles}
            columns={3}
            itemHeight={280}
            gap={24}
renderItem={(article, index, style) => (
                <div key={article.id} style={style} className="w-full h-full">
                    <GlassCard className="overflow-hidden h-full" hover glow>
                    {article.image_url && (
                      <div className="relative h-40 overflow-hidden">
                        <Image
                          src={article.image_url}
                          alt={article.title}
                          fill
                          className="object-cover"
                          unoptimized={isLocalUpload(article.image_url)}
                        />
                      </div>
                    )}
                    <div className="p-5">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="tag" color="secondary">{article.category}</Badge>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onToggleSubscribe(article.id);
                          }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error/10 text-error transition-colors"
                          title="Quitar de guardados"
                        >
                          <MaterialIcon name="bookmark_remove" className="text-[1.1em]" />
                        </button>
                      </div>
                      <h3 className="font-display text-title-md text-on-surface leading-snug line-clamp-2 mb-2">
                        {article.title}
                      </h3>
                      <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3">
                        {article.body.slice(0, 120)}...
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-label-sm text-on-surface-variant">
                          {new Date(article.created_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <Link
                          href={`/news/${article.id}`}
                          className="text-primary text-label-sm font-bold hover:underline flex items-center gap-1"
                        >
                          Leer
                          <MaterialIcon name="arrow_forward" className="text-[1em]" />
                        </Link>
                      </div>
                    </div>
                  </GlassCard>
                </div>
              )}
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

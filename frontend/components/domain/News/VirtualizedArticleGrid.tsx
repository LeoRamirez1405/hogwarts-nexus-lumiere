"use client";

import { VirtuosoGrid } from "react-virtuoso";
import { Article } from "@/lib/api";
import { GlassCard, Badge, MaterialIcon } from "@/components/ui";
import Link from "next/link";
import Image from "next/image";

interface VirtualizedArticleGridProps {
  articles: Article[];
  columns?: 1 | 2 | 3;
  itemHeight?: number;
  gap?: number;
  renderItem?: (article: Article, index: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
  emptyMessage?: string;
  emptyIcon?: string;
  /** Use the window as scroll parent (page flow). Defaults to true. */
  useWindowScroll?: boolean;
}

const DEFAULT_ITEM_HEIGHT = 320;
const DEFAULT_GAP = 24; // 1.5rem = 24px

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isLocalUpload(src?: string): boolean {
  return src?.startsWith("http://localhost:8000/uploads/") ?? false;
}

function DefaultArticleItem({ article, style }: { article: Article; style: React.CSSProperties }) {
  return (
    <div key={article.id} style={style} className="w-full">
      <Link href={`/news/${article.id}`} className="block">
        <GlassCard
          className={`p-5 h-full parchment-texture ${
            article.featured
              ? "border border-secondary/50 shadow-[0_0_20px_rgba(119,90,25,0.25)]"
              : ""
          }`}
          hover
          glow
        >
          {article.image_url && (
            <div className="relative h-40 rounded-xl overflow-hidden mb-4">
              <Image
                src={article.image_url}
                alt={article.title}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                loading="lazy"
                unoptimized={isLocalUpload(article.image_url)}
              />
            </div>
          )}
          <div className="mb-3 flex items-center gap-2">
            <Badge variant="tag" color="secondary">
              {article.category}
            </Badge>
            {article.featured && (
              <Badge variant="rarity" color="secondary">
                <MaterialIcon name="star" className="text-[0.9em] mr-0.5" filled />
                Destacado
              </Badge>
            )}
          </div>
          <h2 className="font-display text-body-md text-on-surface leading-snug mb-2 line-clamp-2">
            {article.title}
          </h2>
          <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
            {article.body.slice(0, 120)}...
          </p>
          <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
            <span>{formatDate(article.created_at)}</span>
            <span className="text-primary font-bold hover:underline flex items-center gap-1">
              Leer
              <MaterialIcon name="arrow_forward" className="text-[1em]" />
            </span>
          </div>
        </GlassCard>
      </Link>
    </div>
  );
}

export function VirtualizedArticleGrid({
  articles,
  columns = 3,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  gap = DEFAULT_GAP,
  renderItem,
  className = "",
  emptyMessage = "No se encontraron artículos",
  emptyIcon = "search_off",
  useWindowScroll = true,
}: VirtualizedArticleGridProps) {
  const itemWidth = `calc((100% - ${gap * (columns - 1)}px) / ${columns})`;

  if (articles.length === 0) {
    return (
      <GlassCard className={`p-12 text-center ${className}`}>
        <MaterialIcon name={emptyIcon} className="text-5xl text-outline-variant mb-3" />
        <p className="text-on-surface-variant text-body-md">{emptyMessage}</p>
      </GlassCard>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <VirtuosoGrid
        data={articles}
        computeItemKey={(index, article) => article.id}
        useWindowScroll={useWindowScroll}
        increaseViewportBy={800}
        overscan={600}
        listClassName="flex flex-wrap"
        itemContent={(index, article) => (
          <div
            key={article.id}
            style={{
              width: itemWidth,
              height: itemHeight + gap,
              paddingBottom: gap,
              boxSizing: "border-box",
            }}
          >
            {renderItem
              ? renderItem(article, index, { width: itemWidth, height: itemHeight })
              : <DefaultArticleItem article={article} style={{ width: itemWidth, height: itemHeight }} />}
          </div>
        )}
      />
    </div>
  );
}

// Mobile bento grid (2 columns, smaller height)
export function VirtualizedBentoGrid({
  articles,
  itemHeight = 200,
  gap = 16,
  className = "",
  emptyMessage = "No hay titulares",
  emptyIcon = "article",
}: Omit<VirtualizedArticleGridProps, "columns" | "renderItem">) {
  return (
    <VirtualizedArticleGrid
      articles={articles}
      columns={2}
      itemHeight={itemHeight}
      gap={gap}
      className={className}
      emptyMessage={emptyMessage}
      emptyIcon={emptyIcon}
    />
  );
}

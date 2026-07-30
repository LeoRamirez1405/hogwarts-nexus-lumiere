"use client";

import { useRouter } from "next/navigation";
import { Article } from "@/lib/api";
import { GlassCard, Badge, MaterialIcon } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface ArticleCardProps {
  article: Article;
  onSubscribe: (id: string) => void;
}

export function ArticleCard({ article, onSubscribe }: ArticleCardProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSubscribe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    onSubscribe(article.id);
  };

  return (
    <GlassCard
      className={`p-5 cursor-pointer ${
        article.featured
          ? "border border-secondary/50 shadow-[0_0_20px_rgba(119,90,25,0.25)] hover:shadow-[0_0_28px_rgba(119,90,25,0.4)]"
          : ""
      }`}
      hover
      onClick={() => router.push(`/news/${article.id}`)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="tag">{article.category}</Badge>
        {article.featured && (
          <Badge variant="rarity" color="secondary">
            <MaterialIcon name="star" className="text-[0.9em] mr-0.5" filled />
            Destacado
          </Badge>
        )}
        <span className="text-label-sm text-on-surface-variant">
          {formatDate(article.created_at)}
        </span>
        {user && (
          <button
            onClick={handleSubscribe}
            className={`ml-auto p-2 rounded-full transition-colors ${
              article.subscribed
                ? "bg-secondary text-on-secondary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-secondary-container"
            }`}
            aria-label={article.subscribed ? "Dejar de seguir" : "Seguir"}
          >
            <MaterialIcon
              name={article.subscribed ? "bookmark_remove" : "bookmark_add"}
              className="text-sm"
            />
          </button>
        )}
      </div>
      <h3 className="font-display text-title-md text-on-surface mb-2 leading-snug">
        {article.title}
      </h3>
      <p className="text-label-sm text-on-surface-variant line-clamp-2">
        {article.body.slice(0, 120)}
        {article.body.length > 120 ? "..." : ""}
      </p>
    </GlassCard>
  );
}
"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { Article } from "@/lib/api";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface MoreArticlesSidebarProps {
  articles: Article[];
  featuredId?: string;
}

export function MoreArticlesSidebar({ articles, featuredId }: MoreArticlesSidebarProps) {
  const sidebarArticles = articles.filter((a) => a.id !== featuredId).slice(0, 3);

  if (sidebarArticles.length === 0) return null;

  return (
    <div className="glass-card p-5">
      <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
        <MaterialIcon name="auto_stories" className="text-primary text-xl" />
        Mas Noticias
      </h3>
      <div className="space-y-4">
        {sidebarArticles.map((a) => (
          <Link key={a.id} href={`/news/${a.id}`} className="block group">
            <h4 className="text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors leading-snug">
              {a.title}
            </h4>
            <p className="text-label-sm text-on-surface-variant mt-0.5">
              {formatDate(a.created_at)}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
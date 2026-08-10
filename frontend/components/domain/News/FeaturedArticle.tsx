"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Article } from "@/lib/api";
import { GlassCard, Badge, Button, Avatar, MaterialIcon } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { isStoredUpload } from "@/lib/media";

function isLocalUpload(src?: string): boolean {
  return isStoredUpload(src);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface FeaturedArticleProps {
  article: Article;
  onSubscribe: (id: string) => void;
}

export function FeaturedArticle({ article, onSubscribe }: FeaturedArticleProps) {
  const router = useRouter();
  const { user } = useAuthStore();

  const handleSubscribe = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;
    onSubscribe(article.id);
  };

  return (
    <GlassCard className="overflow-hidden md:border-r-4 md:border-r-secondary/30" hover glow>
      {article.image_url && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
            unoptimized={isLocalUpload(article.image_url)}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
            <Badge variant="rarity" color="secondary">
              Exclusivo
            </Badge>
            {user && (
              <button
                onClick={handleSubscribe}
                className={`p-2 rounded-full transition-colors ${
                  article.subscribed
                    ? "bg-secondary text-on-secondary"
                    : "bg-white/10 text-on-surface hover:bg-white/20"
                }`}
                aria-label={article.subscribed ? "Dejar de seguir" : "Seguir"}
              >
                <MaterialIcon
                  name={article.subscribed ? "bookmark_remove" : "bookmark_add"}
                  className="text-lg"
                />
              </button>
            )}
          </div>
        </div>
      )}
      <div className="p-6 md:p-8">
        {!article.image_url && (
          <div className="mb-4 flex items-center justify-between">
            <Badge variant="rarity" color="secondary">Exclusivo</Badge>
            {user && (
              <button
                onClick={handleSubscribe}
                className={`p-2 rounded-full transition-colors ${
                  article.subscribed
                    ? "bg-secondary text-on-secondary"
                    : "bg-white/10 text-on-surface hover:bg-white/20"
                }`}
                aria-label={article.subscribed ? "Dejar de seguir" : "Seguir"}
              >
                <MaterialIcon
                  name={article.subscribed ? "bookmark_remove" : "bookmark_add"}
                  className="text-lg"
                />
              </button>
            )}
          </div>
        )}
        <h2 className="font-display text-headline-lg md:text-display-lg text-on-surface leading-tight mb-3">
          {article.title}
        </h2>
        <p className="text-body-md text-on-surface-variant mb-4 line-clamp-3">
          {article.body.slice(0, 200)}
          {article.body.length > 200 ? "..." : ""}
        </p>
        <div className="flex items-center justify-between">
          {article.author ? (
            <Link
              href={`/profile/${article.author.id}`}
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={article.author.avatar_url}
                alt={article.author.name}
                size="sm"
                initials={article.author.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              />
              <div>
                <p className="text-body-md font-semibold text-on-surface hover:text-primary transition-colors">
                  {article.author.name}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  {formatDate(article.created_at)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="flex items-center gap-3">
              <div>
                <p className="text-body-md font-semibold text-on-surface">Autor</p>
                <p className="text-label-sm text-on-surface-variant">
                  {formatDate(article.created_at)}
                </p>
              </div>
            </div>
          )}
          <Button
            variant="secondary"
            icon="arrow_forward"
            iconPosition="right"
            size="sm"
            onClick={() => router.push(`/news/${article.id}`)}
          >
            Leer Mas
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}
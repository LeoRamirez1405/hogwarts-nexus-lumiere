"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, Article } from "@/lib/api";
import { GlassCard, Badge, Button, Avatar } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

function isLocalUpload(src?: string): boolean {
  return src?.startsWith("http://localhost:8000/uploads/") ?? false;
}

interface Comment {
  id: string;
  author: string;
  avatar?: string;
  body: string;
  created_at: string;
}

const seedComments: Comment[] = [
  {
    id: "c1",
    author: "Luna Lovegood",
    avatar: "",
    body: "Sabia que esto iba a pasar. Los snorkacks lo advertian.",
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "c2",
    author: "Cedric Diggory",
    avatar: "",
    body: "Excelente reportaje, muy bien investigado.",
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "c3",
    author: "Hermione Granger",
    avatar: "",
    body: "Deberian verificar las fuentes del articulo antes de publicar.",
    created_at: new Date(Date.now() - 10800000).toISOString(),
  },
];

export default function ArticleDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [article, setArticle] = useState<Article | null>(null);
  const [related, setRelated] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>(seedComments);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    Promise.all([api.getArticles()])
      .then(([all]) => {
        if (cancelled) return;
        const found = all.find((a) => a.id === params.id);
        if (!found) {
          router.push("/news");
          return;
        }
        setArticle(found);
        setRelated(
          all.filter((a) => a.id !== found.id && a.category === found.category).slice(0, 3)
        );
      })
      .catch(() => {
        if (!cancelled) router.push("/news");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const handleSubmitComment = () => {
    if (!newComment.trim() || !authUser) return;
    setPosting(true);
    const c: Comment = {
      id: `c${Date.now()}`,
      author: authUser.name,
      avatar: authUser.avatar_url,
      body: newComment.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [c, ...prev]);
    setNewComment("");
    setPosting(false);
  };

  if (loading || !article) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <span className="material-symbols-outlined text-5xl text-outline-variant animate-spin mb-3">
          progress_activity
        </span>
        <p className="text-on-surface-variant text-body-md">
          Abriendo edicion...
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-8">
      {/* Back link */}
      <button
        onClick={() => router.push("/news")}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
      >
        <span className="material-symbols-outlined text-xl">arrow_back</span>
        <span className="text-body-md">Volver al Quisquilloso</span>
      </button>

      {/* Article header */}
      <article className="max-w-3xl mx-auto">
        <div className="quibbler-border py-3 mb-6 text-center">
          <p className="text-label-sm tracking-[0.2em] text-on-surface-variant uppercase">
            El Quisquilloso &middot; {formatDate(article.created_at)}
          </p>
        </div>

        <div className="flex items-center gap-2 mb-4 justify-center">
          <Badge variant="tag" color="secondary">
            {article.category}
          </Badge>
          {article.featured && (
            <Badge variant="rarity" color="secondary">
              Exclusivo
            </Badge>
          )}
        </div>

        <h1 className="font-display text-headline-lg md:text-display-lg text-on-surface leading-tight text-center mb-6">
          {article.title}
        </h1>

        {article.author && (
          <div className="flex items-center justify-center gap-3 mb-8">
            <Avatar
              src={article.author.avatar_url}
              alt={article.author.name}
              size="sm"
              initials={article.author.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            />
            <div className="text-left">
              <p className="text-body-md font-semibold text-on-surface">
                {article.author.name}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                Corresponsal &middot; {timeAgo(article.created_at)}
              </p>
            </div>
          </div>
        )}

        {article.image_url && (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
            <Image
              src={article.image_url}
              alt={article.title}
              fill
              className="object-cover"
              unoptimized={isLocalUpload(article.image_url)}
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none">
          {article.body.split("\n").map((para, i) => (
            <p
              key={i}
              className="text-body-md text-on-surface-variant leading-relaxed mb-4 first-letter:font-display first-letter:text-4xl first-letter:text-secondary first-letter:mr-1 first-letter:float-left first-letter:leading-none"
            >
              {para}
            </p>
          ))}
        </div>

        {/* Article actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLiked((v) => !v)}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface-container-high hover:bg-secondary-container text-on-surface-variant hover:text-on-secondary-container transition-colors"
              aria-label="Me gusta"
            >
              <span
                className="material-symbols-outlined text-xl"
                style={{
                  fontVariationSettings: liked
                    ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
                    : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                }}
              >
                favorite
              </span>
            </button>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
              }}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface-container-high hover:bg-primary-container text-on-surface-variant hover:text-on-primary-container transition-colors"
              aria-label="Compartir"
            >
              <span className="material-symbols-outlined text-xl">share</span>
            </button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon="bookmark"
            onClick={() => {}}
          >
            Guardar
          </Button>
        </div>
      </article>

      {/* Comments */}
      <section className="max-w-3xl mx-auto">
        <h2 className="font-display text-headline-lg text-on-surface mb-4 flex items-center gap-2">
          <span
            className="material-symbols-outlined text-secondary"
            style={{
              fontVariationSettings:
                '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24',
            }}
          >
            comment
          </span>
          Cartas al Director ({comments.length})
        </h2>

        {authUser && (
          <GlassCard className="p-4 mb-4">
            <div className="flex gap-3">
              <Avatar
                src={authUser.avatar_url}
                alt={authUser.name}
                size="sm"
                initials={authUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              />
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe tu carta..."
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-20 resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="send"
                    onClick={handleSubmitComment}
                    disabled={posting || !newComment.trim()}
                  >
                    {posting ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        <div className="space-y-3">
          {comments.map((c) => (
            <GlassCard key={c.id} className="p-4">
              <div className="flex gap-3">
                <Avatar
                  src={c.avatar}
                  alt={c.author}
                  size="sm"
                  initials={c.author
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-body-md font-semibold text-on-surface">
                      {c.author}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      {timeAgo(c.created_at)}
                    </p>
                  </div>
                  <p className="text-body-md text-on-surface-variant leading-relaxed">
                    {c.body}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section className="max-w-4xl mx-auto">
          <h2 className="font-display text-headline-lg text-on-surface mb-4 flex items-center gap-2">
            <span
              className="material-symbols-outlined text-primary"
              style={{
                fontVariationSettings:
                  '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24',
              }}
            >
              auto_stories
            </span>
            Mas de {article.category}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {related.map((a) => (
              <Link key={a.id} href={`/news/${a.id}`} className="block group">
                <GlassCard className="p-5 h-full" hover>
                  <Badge variant="tag">{a.category}</Badge>
                  <h3 className="font-display text-title-md text-on-surface mt-2 leading-snug group-hover:text-primary transition-colors">
                    {a.title}
                  </h3>
                  <p className="text-label-sm text-on-surface-variant mt-2 line-clamp-2">
                    {a.body.slice(0, 120)}...
                  </p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

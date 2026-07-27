"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Article, Announcement, Classified, ForumThread } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { GlassCard, Badge, Button, MaterialIcon } from "@/components/ui";
import {
  FeaturedArticle,
  ArticleCard,
  AnnouncementsSidebar,
  ClassifiedsSidebar,
  MoreArticlesSidebar,
  ForumThreads,
  NewThreadModal,
} from "@/components/domain/News";

function isLocalUpload(src?: string): boolean {
  return src?.startsWith("http://localhost:8000/uploads/") ?? false;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface Thread {
  id: string;
  title: string;
  body: string;
  category: string;
  voteCount: number;
  userVote: 0 | 1 | -1;
  commentCount: number;
}

function toThread(f: ForumThread): Thread {
  return {
    id: f.id,
    title: f.title,
    body: f.body,
    category: f.category,
    voteCount: f.vote_count,
    userVote: (f.my_vote as 0 | 1 | -1) ?? 0,
    commentCount: f.comment_count,
  };
}

export default function NewsPage() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"recent" | "featured">("recent");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [votedThread, setVotedThread] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getArticles(),
      api.getAnnouncements(),
      api.getClassifieds(),
      api.getThreads().catch(() => [] as ForumThread[]),
    ])
      .then(([all, ann, cls, forumThreads]) => {
        setArticles(all);
        setAnnouncements(ann);
        setClassifieds(cls);
        setThreads(forumThreads.map(toThread));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featured = articles.find((a) => a.featured) ?? articles[0];

  const sortedArticles =
    filter === "featured"
      ? [...articles].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
      : [...articles].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

  const handleVote = useCallback(
    async (threadId: string, dir: 1 | -1) => {
      if (!authUser) return;
      setVotedThread(threadId);
      try {
        const updated = await api.voteThread(threadId, dir);
        setThreads((prev) =>
          prev.map((t) => (t.id === threadId ? toThread(updated) : t))
        );
      } catch {
        // ignore
      }
    },
    [authUser]
  );

  const handleCreateThread = useCallback(
    async (data: { title: string; body: string; category: string }) => {
      if (!authUser) return;
      try {
        const created = await api.createThread(data);
        setThreads((prev) => [toThread(created), ...prev]);
      } catch {
        // ignore
      }
    },
    [authUser]
  );

  const handleSubscribe = useCallback(async (articleId: string) => {
    if (!authUser) return;
    try {
      const article = articles.find((a) => a.id === articleId);
      if (!article) return;
      if (article.subscribed) {
        await api.unsubscribeArticle(articleId);
      } else {
        await api.subscribeArticle(articleId);
      }
      setArticles((prev) =>
        prev.map((a) => (a.id === articleId ? { ...a, subscribed: !a.subscribed } : a))
      );
    } catch {
      // error
    }
  }, [authUser, articles]);

  return (
    <div className="space-y-10 pb-16">
      {/* ===== DESKTOP MASTHEAD ===== */}
      <div className="hidden md:block quibbler-border py-8 text-center">
        <div className="flex items-center justify-center gap-4 text-label-sm tracking-[0.2em] text-on-surface-variant uppercase mb-2">
          <span>EST. 1990</span>
          <span className="text-secondary">|</span>
          <span>Hogwarts</span>
          <span className="text-secondary">|</span>
          <span>La fuente magica de noticias</span>
          <span className="text-secondary">|</span>
          <span className="text-secondary font-bold">PRECIO: 2 ZERINES</span>
        </div>
        <h1 className="font-display text-[64px] lg:text-[84px] text-on-surface leading-none tracking-tight">
          EL QUISQUILLOSO
        </h1>
      </div>

      {/* ===== MOBILE SECTION HEADER ===== */}
      <div className="md:hidden">
        <div className="flex items-center gap-3">
          <MaterialIcon name="newspaper" className="text-3xl text-secondary" filled />
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              El Quisquilloso
            </h1>
            <p className="text-label-sm text-on-surface-variant">
              La fuente magica de noticias
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <MaterialIcon
            name="progress_activity"
            className="text-5xl text-outline-variant animate-spin mb-3"
          />
          <p className="text-on-surface-variant text-body-md">
            Cargando edicion...
          </p>
        </div>
      ) : (
        <>
          {/* ===== DESKTOP: FEATURED + SIDEBAR ===== */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Featured */}
            <div className="md:col-span-8">
              {featured ? (
                <FeaturedArticle article={featured} onSubscribe={handleSubscribe} />
              ) : (
                <GlassCard className="p-12 text-center">
                  <MaterialIcon
                    name="newspaper"
                    className="text-5xl text-outline-variant mb-3"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    No hay articulos destacados hoy
                  </p>
                </GlassCard>
              )}
            </div>

            {/* Sidebar */}
            <div className="md:col-span-4 space-y-6">
              {/* Announcements */}
              <AnnouncementsSidebar announcements={announcements} />

              {/* Classified Ads */}
              <ClassifiedsSidebar classifieds={classifieds} />

              {/* More articles */}
              <MoreArticlesSidebar articles={articles} featuredId={featured?.id} />
            </div>
          </div>

          {/* ===== MOBILE: FEATURED CARD ===== */}
          <div className="md:hidden">
            {featured ? (
              <div className="parchment-texture rounded-2xl overflow-hidden border border-secondary/10">
                {featured.image_url && (
                  <div className="relative h-48 overflow-hidden">
                    <Image
                      src={featured.image_url}
                      alt={featured.title}
                      fill
                      className="object-cover"
                      unoptimized={isLocalUpload(featured.image_url)}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/50 to-transparent" />
                  </div>
                )}
                <div className="p-5">
                  <div className="mb-3">
                    <Badge variant="rarity" color="secondary">
                      Exclusivo
                    </Badge>
                  </div>
                  <h2 className="font-display text-headline-lg-mobile text-on-surface leading-tight mb-2">
                    {featured.title}
                  </h2>
                  <p className="text-label-sm text-on-surface-variant mb-4 line-clamp-2">
                    {featured.body.slice(0, 150)}...
                  </p>
                  <Button
                    variant="secondary"
                    icon="arrow_forward"
                    iconPosition="right"
                    size="sm"
                    onClick={() => router.push(`/news/${featured.id}`)}
                  >
                    Leer Mas
                  </Button>
                </div>
              </div>
            ) : (
              <GlassCard className="p-8 text-center">
                <MaterialIcon
                  name="newspaper"
                  className="text-5xl text-outline-variant mb-3"
                />
                <p className="text-on-surface-variant text-body-md">
                  Sin edicion hoy
                </p>
              </GlassCard>
            )}
          </div>

          {/* ===== MOBILE: BENTO HEADLINES ===== */}
          <div className="md:hidden">
            <h2 className="font-display text-title-md text-on-surface mb-4 flex items-center gap-2">
              <MaterialIcon name="bolt" className="text-secondary" filled />
              Titulares
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {articles.slice(0, 4).map((a) => (
                <Link key={a.id} href={`/news/${a.id}`} className="block">
                  <GlassCard className="p-4 h-full" hover glow>
                    <div className="mb-2">
                      <Badge variant="tag" color="secondary">
                        {a.category}
                      </Badge>
                    </div>
                    <h3 className="font-display text-body-md text-on-surface leading-snug line-clamp-3">
                      {a.title}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant mt-2">
                      {formatDate(a.created_at)}
                    </p>
                  </GlassCard>
                </Link>
              ))}
            </div>
          </div>

          {/* ===== DESKTOP: ALL ARTICLES GRID ===== */}
          <div className="hidden md:block">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-headline-lg text-on-surface flex items-center gap-3">
                <MaterialIcon name="auto_stories" className="text-primary" filled />
                Ediciones Recientes
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFilter("recent")}
                  className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                    filter === "recent"
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  Recientes
                </button>
                <button
                  onClick={() => setFilter("featured")}
                  className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                    filter === "featured"
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  Destacadas
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedArticles.map((a) => (
                <ArticleCard key={a.id} article={a} onSubscribe={handleSubscribe} />
              ))}
              {articles.length === 0 && (
                <GlassCard className="col-span-full p-12 text-center">
                  <MaterialIcon
                    name="article"
                    className="text-5xl text-outline-variant mb-3"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    Aun no hay ediciones disponibles
                  </p>
                </GlassCard>
              )}
            </div>
          </div>

          {/* ===== FORUM SECTION ===== */}
          <div>
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
              <h2 className="font-display text-headline-lg text-on-surface flex items-center gap-3">
                <MaterialIcon name="forum" className="text-secondary" filled />
                Foro del Quisquilloso
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="add"
                  onClick={() => setShowNewThread(true)}
                  disabled={!authUser}
                >
                  Iniciar Debate
                </Button>
              </div>
            </div>

            <ForumThreads
              threads={threads}
              votedThread={votedThread}
              onVote={handleVote}
            />
          </div>

          {/* ===== ZERINES WIDGET (MOBILE) ===== */}
          <div className="md:hidden">
            <div className="glass-card magical-float rounded-2xl p-6 inner-glow-gold border border-secondary/10">
              <div className="flex items-center gap-3">
                <MaterialIcon
                  name="diamond"
                  className="text-3xl text-secondary"
                  filled
                />
                <div>
                  <p className="text-title-md font-display text-on-surface">
                    Zerines del Dia
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    Gana 5 Zerines por cada comentario en el foro
                  </p>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ===== NEW THREAD MODAL ===== */}
      <NewThreadModal
        isOpen={showNewThread}
        onClose={() => setShowNewThread(false)}
        onSubmit={handleCreateThread}
      />
    </div>
  );
}
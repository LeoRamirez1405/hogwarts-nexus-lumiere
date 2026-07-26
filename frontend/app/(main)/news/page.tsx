"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Article } from "@/lib/api";
import { GlassCard, Badge, Button, Avatar } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

function isLocalUpload(src?: string): boolean {
  return src?.startsWith("http://localhost:8000/uploads/") ?? false;
}

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const announcements = [
  "La Copa de las Casas arranca el proximo viernes en el Gran Salon",
  "Nuevas reglas para el Santuario de Mascotas: maximo 3 criaturas por estudiante",
  "Flourish & Blotts ofrece un 20% de descuento en libros de pociones esta semana",
];

const classifiedAds = [
  { title: "Vendo escoba Nimbus 2001", price: "150 Zerines" },
  { title: "Se buscan voluntarios para Hogsmeade", price: "Gratis" },
  { title: "Intercambio de cartas de Quidditch", price: "A convenir" },
];

interface Thread {
  id: string;
  title: string;
  body: string;
  category: string;
  voteCount: number;
  userVote: 0 | 1 | -1;
  commentCount: number;
}

function FeaturedArticle({ article }: { article: Article }) {
  const router = useRouter();
  return (
    <GlassCard className="overflow-hidden md:border-r-4 md:border-r-secondary/30" hover glow>
      {article.image_url && (
        <div className="relative h-64 md:h-80 overflow-hidden">
          <Image
            src={article.image_url}
            alt={article.title}
            fill
            className="object-cover"
            unoptimized={isLocalUpload(article.image_url)}
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <Badge variant="rarity" color="secondary">
              Exclusivo
            </Badge>
          </div>
        </div>
      )}
      <div className="p-6 md:p-8">
        {!article.image_url && (
          <div className="mb-4">
            <Badge variant="rarity" color="secondary">
              Exclusivo
            </Badge>
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
          <div className="flex items-center gap-3">
            {article.author && (
              <Avatar
                src={article.author.avatar_url}
                alt={article.author.name}
                size="sm"
                initials={article.author.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              />
            )}
            <div>
              <p className="text-body-md font-semibold text-on-surface">
                {article.author?.name ?? "Autor"}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {formatDate(article.created_at)}
              </p>
            </div>
          </div>
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

function ArticleCard({ article }: { article: Article }) {
  const router = useRouter();
  return (
    <GlassCard
      className="p-5 cursor-pointer"
      hover
      onClick={() => router.push(`/news/${article.id}`)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="tag">{article.category}</Badge>
        <span className="text-label-sm text-on-surface-variant">
          {formatDate(article.created_at)}
        </span>
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

export default function NewsPage() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"recent" | "featured">("recent");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [votedThread, setVotedThread] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThread, setNewThread] = useState({ title: "", body: "", category: "General" });
  const [postingThread, setPostingThread] = useState(false);

  useEffect(() => {
    api
      .getArticles()
      .then((all) => {
        setArticles(all);
        const seedThreads: Thread[] = all.slice(0, 5).map((a, i) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          category: a.category,
          voteCount: ((i + 1) * 17 + 13) % 55,
          userVote: 0,
          commentCount: ((i + 1) * 7 + 3) % 35,
        }));
        setThreads(seedThreads);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const featured = articles.find((a) => a.featured) ?? articles[0];
  const sidebarArticles = articles
    .filter((a) => a.id !== featured?.id)
    .slice(0, 3);

  const sortedArticles =
    filter === "featured"
      ? [...articles].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
      : [...articles].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

  const handleVote = (threadId: string, dir: 1 | -1) => {
    setThreads((prev) =>
      prev.map((t) => {
        if (t.id !== threadId) return t;
        let newVote: 0 | 1 | -1 = dir;
        let delta = dir;
        if (t.userVote === dir) {
          newVote = 0;
          delta = dir === 1 ? -1 : 1;
        } else if (t.userVote !== 0) {
          delta = dir * 2;
        }
        return { ...t, voteCount: t.voteCount + delta, userVote: newVote };
      })
    );
    setVotedThread(threadId);
  };

  const handleCreateThread = () => {
    if (!newThread.title.trim()) return;
    setPostingThread(true);
    const t: Thread = {
      id: `t${Date.now()}`,
      title: newThread.title.trim(),
      body: newThread.body.trim() || "Sin contenido",
      category: newThread.category,
      voteCount: 1,
      userVote: 1,
      commentCount: 0,
    };
    setThreads((prev) => [t, ...prev]);
    setNewThread({ title: "", body: "", category: "General" });
    setShowNewThread(false);
    setPostingThread(false);
  };

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
                <FeaturedArticle article={featured} />
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
              <div className="bg-secondary-fixed/20 border-l-4 border-secondary rounded-r-xl p-5">
                <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
                  <MaterialIcon
                    name="campaign"
                    className="text-secondary text-xl"
                    filled
                  />
                  Anuncios
                </h3>
                <ul className="space-y-3">
                  {announcements.map((a, i) => (
                    <li
                      key={i}
                      className="text-label-sm text-on-surface-variant leading-relaxed border-b border-secondary/10 pb-2 last:border-0 last:pb-0"
                    >
                      {a}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Classified Ads */}
              <GlassCard className="p-5">
                <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
                  <MaterialIcon name="sell" className="text-primary text-xl" />
                  Clasificados
                </h3>
                <div className="space-y-3">
                  {classifiedAds.map((ad, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2 border-b border-outline-variant/10 last:border-0"
                    >
                      <span className="text-label-sm text-on-surface font-medium">
                        {ad.title}
                      </span>
                      <Badge variant="tag" color="secondary">
                        {ad.price}
                      </Badge>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* More articles */}
              {sidebarArticles.length > 0 && (
                <GlassCard className="p-5">
                  <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
                    <MaterialIcon name="auto_stories" className="text-primary text-xl" />
                    Mas Noticias
                  </h3>
                  <div className="space-y-4">
                    {sidebarArticles.map((a) => (
                      <Link
                        key={a.id}
                        href={`/news/${a.id}`}
                        className="block group"
                      >
                        <h4 className="text-body-md font-semibold text-on-surface group-hover:text-primary transition-colors leading-snug">
                          {a.title}
                        </h4>
                        <p className="text-label-sm text-on-surface-variant mt-0.5">
                          {formatDate(a.created_at)}
                        </p>
                      </Link>
                    ))}
                  </div>
                </GlassCard>
              )}
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
                <ArticleCard key={a.id} article={a} />
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

            <div className="space-y-3">
              {threads.map((thread) => {
                const avatarLetters = ["A", "B", "C"];
                return (
                  <GlassCard
                    key={thread.id}
                    className="p-5 parchment-texture"
                    hover
                    onClick={() => router.push(`/news/${thread.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Vote counter */}
                      <div className="flex flex-col items-center gap-1 text-center min-w-[40px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(thread.id, 1);
                          }}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${
                            thread.userVote === 1
                              ? "bg-secondary-container text-on-secondary-container"
                              : "text-on-surface-variant hover:bg-surface-container-high"
                          }`}
                          aria-label="Votar positivo"
                        >
                          <MaterialIcon name="expand_less" className="text-xl" />
                        </button>
                        <span className="text-body-md font-bold text-on-surface">
                          {thread.voteCount}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(thread.id, -1);
                          }}
                          className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${
                            thread.userVote === -1
                              ? "bg-error-container text-on-error-container"
                              : "text-on-surface-variant hover:bg-surface-container-high"
                          }`}
                          aria-label="Votar negativo"
                        >
                          <MaterialIcon name="expand_more" className="text-xl" />
                        </button>
                      </div>

                      {/* Thread info */}
                      <div className="flex-1 min-w-0 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="tag">{thread.category}</Badge>
                          {votedThread === thread.id && thread.userVote !== 0 && (
                            <Badge variant="count" color="secondary">
                              {thread.userVote === 1 ? "+1" : "-1"}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-body-md font-semibold text-on-surface leading-snug">
                          {thread.title}
                        </h3>
                        <p className="text-label-sm text-on-surface-variant mt-1 line-clamp-1">
                          {thread.body.slice(0, 100)}...
                        </p>
                      </div>

                      {/* Avatar stack & meta */}
                      <div className="hidden md:flex items-center gap-4 text-on-surface-variant shrink-0">
                        <div className="flex items-center gap-1">
                          <MaterialIcon name="chat_bubble_outline" className="text-lg" />
                          <span className="text-label-sm">
                            {thread.commentCount}
                          </span>
                        </div>
                        <div className="flex -space-x-2">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="w-6 h-6 rounded-full bg-surface-container-high border-2 border-surface flex items-center justify-center"
                            >
                              <span className="text-[8px] text-on-surface-variant">
                                {avatarLetters[i]}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </GlassCard>
                );
              })}

              {threads.length === 0 && (
                <GlassCard className="p-12 text-center">
                  <MaterialIcon
                    name="forum"
                    className="text-5xl text-outline-variant mb-3"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    Aun no hay debates abiertos
                  </p>
                  <p className="text-on-surface-variant/60 text-label-sm mt-1">
                    Se el primero en iniciar una discusion
                  </p>
                </GlassCard>
              )}
            </div>
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
      {showNewThread && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowNewThread(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="font-display text-title-md text-on-surface">
                Iniciar Debate
              </h2>
              <button
                onClick={() => setShowNewThread(false)}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                aria-label="Cerrar"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Titulo del debate
                </label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) =>
                    setNewThread((p) => ({ ...p, title: e.target.value }))
                  }
                  placeholder="Ej: ?Es el Snorkack real?"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Categoria
                </label>
                <select
                  value={newThread.category}
                  onChange={(e) =>
                    setNewThread((p) => ({ ...p, category: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                >
                  <option value="General">General</option>
                  <option value="Zoologia Magica">Zoologia Magica</option>
                  <option value="Economia">Economia</option>
                  <option value="Ministerio">Ministerio</option>
                  <option value="Hogwarts">Hogwarts</option>
                  <option value="Callejones">Callejones</option>
                </select>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Contenido
                </label>
                <textarea
                  value={newThread.body}
                  onChange={(e) =>
                    setNewThread((p) => ({ ...p, body: e.target.value }))
                  }
                  placeholder="Argumenta tu postura..."
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20">
              <Button
                variant="secondary"
                onClick={() => setShowNewThread(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateThread}
                disabled={postingThread || !newThread.title.trim()}
                className="flex-1"
              >
                {postingThread ? "Publicando..." : "Publicar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

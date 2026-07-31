"use client";

import { useState, useCallback, useRef, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, Article } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { toastError } from "@/lib/toastStore";
import { GlassCard, Badge, Button, MaterialIcon, TabGroup, ListFooter } from "@/components/ui";
import {
  FeaturedArticle,
  AnnouncementsSidebar,
  ClassifiedsSidebar,
  ForumThreads,
  NewThreadModal,
  type ForumThreadsHandle,
  VirtualizedArticleGrid,
} from "@/components/domain/News";
import { useNewsPage } from "@/hooks/useNewsPage";

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

export default function NewsPage() {
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const forumRef = useRef<ForumThreadsHandle>(null);

  const [filter, setFilter] = useState<"recent" | "featured">("recent");
  const [votedThread, setVotedThread] = useState<string | null>(null);
  const [showNewThread, setShowNewThread] = useState(false);
  const [activeTab, setActiveTab] = useState("news");

  const {
    articles: allArticles,
    featuredArticles,
    articlesHasMore,
    articlesLoading,
    articlesLoadingMore,
    articlesTotal,
    articlesTotalCount,
    loadMoreArticles,
    refreshArticles,
    featuredHasMore,
    featuredLoading,
    featuredLoadingMore,
    featuredTotal,
    featuredTotalCount,
    loadMoreFeatured,
    refreshFeatured,
    announcements: allAnnouncements,
    announcementsLoading,
    classifieds: allClassifieds,
    classifiedsLoading,
    savedArticles: allSaved,
    savedHasMore,
    savedLoading,
    savedLoadingMore,
    savedTotal,
    savedTotalCount,
    loadMoreSaved,
    refreshSaved,
    loading,
    loadError,
    retry,
  } = useNewsPage();

  const handleVote = useCallback(
    (threadId: string) => {
      if (!authUser) return;
      setVotedThread(threadId);
    },
    [authUser]
  );

  const handleCreateThread = useCallback(
    async (data: { title: string; body: string; category: string }) => {
      if (!authUser) return;
      try {
        await api.createThread(data);
        forumRef.current?.refresh();
      } catch {
        // ignore
      }
    },
    [authUser]
  );

  const handleDeleteThread = useCallback(
    () => {
      if (!authUser) return;
      forumRef.current?.refresh();
    },
    [authUser]
  );

  const handleSubscribe = useCallback(async (articleId: string) => {
    if (!authUser) return;
    try {
      const article =
        allArticles.find((a) => a.id === articleId) ??
        featuredArticles.find((a) => a.id === articleId);
      if (!article) return;
      if (article.subscribed) {
        await api.unsubscribeArticle(articleId);
      } else {
        await api.subscribeArticle(articleId);
      }
      // Only refresh the active list(s) to avoid unnecessary refetches
      refreshArticles();
      if (filter === "featured") {
        refreshFeatured();
      }
      if (activeTab === "saved") {
        refreshSaved();
      }
    } catch (e) {
      toastError("No se pudo cambiar la suscripción", e);
    }
  }, [authUser, allArticles, featuredArticles, filter, activeTab, refreshArticles, refreshFeatured, refreshSaved]);

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  const byDateDesc = useCallback((a: Article, b: Article) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime(), []);

  // El artículo principal es el fijado (pinned); si no hay ninguno, el más reciente.
  const mostRecent = useMemo(() => [...allArticles].sort(byDateDesc)[0], [allArticles, byDateDesc]);
  const featured = useMemo(() => allArticles.find((a) => a.pinned) ?? mostRecent, [allArticles, mostRecent]);

  // Cada pestaña tiene su propia lista paginada con lazy loading independiente.
  const isFeatured = filter === "featured";
  const activeItems = isFeatured ? featuredArticles : allArticles;
  const activeHasMore = isFeatured ? featuredHasMore : articlesHasMore;
  const activeLoadingMore = isFeatured ? featuredLoadingMore : articlesLoadingMore;
  const activeTotal = isFeatured ? featuredTotal : articlesTotal;
  const activeTotalCount = isFeatured ? featuredTotalCount : articlesTotalCount;
  const activeListLoading = isFeatured ? featuredLoading : false;
  const loadMoreActive = isFeatured ? loadMoreFeatured : loadMoreArticles;

  const sortedArticles = useMemo(() => [...activeItems].sort(byDateDesc), [activeItems, byDateDesc]);

  const visibleArticles = sortedArticles;

  return (
    <div className="space-y-10 pb-16">
      {/* ===== DESKTOP MASTHEAD ===== */}
      <div className="hidden md:block quibbler-border py-8 text-center">
        <div className="flex items-center justify-center gap-4 text-label-sm tracking-[0.2em] text-on-surface-variant uppercase mb-2">
          <span>EST. 1990</span>
          <span className="text-secondary">|</span>
          <span>Hogwarts</span>
          <span className="text-secondary">|</span>
          <span>La fuente mágica de noticias</span>
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
              La fuente mágica de noticias
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabGroup
        tabs={[
          { id: "news", label: "Noticias", icon: "newspaper" },
          { id: "saved", label: "Guardados", icon: "bookmark" },
        ]}
        activeTab={activeTab}
        onChange={handleTabChange}
      />

      {activeTab === "news" && (articlesLoading ? (
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
                    No hay artículos destacados hoy
                  </p>
                </GlassCard>
              )}
            </div>

            {/* Sidebar */}
            <div className="md:col-span-4 space-y-6">
              {/* Announcements */}
              <AnnouncementsSidebar announcements={allAnnouncements} loading={announcementsLoading} />

              {/* Classified Ads */}
              <ClassifiedsSidebar classifieds={allClassifieds} loading={classifiedsLoading} />

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
                      sizes="100vw"
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-title-md text-on-surface flex items-center gap-2">
                <MaterialIcon name="bolt" className="text-secondary" filled />
                Titulares
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/news/all")}
                className="text-primary font-medium"
              >
                Ver todos
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {sortedArticles.slice(0, 4).map((a) => (
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

          {/* ===== MOBILE: ANNOUNCEMENTS & CLASSIFIEDS ===== */}
          <div className="md:hidden space-y-6">
            <AnnouncementsSidebar announcements={allAnnouncements} loading={announcementsLoading} />
            <ClassifiedsSidebar classifieds={allClassifieds} loading={classifiedsLoading} />
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
            {visibleArticles.length === 0 && activeListLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <MaterialIcon
                  name="progress_activity"
                  className="text-5xl text-outline-variant animate-spin mb-3"
                />
                <p className="text-on-surface-variant text-body-md">Cargando...</p>
              </div>
            ) : visibleArticles.length === 0 && !activeListLoading ? (
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
                <div style={{ height: Math.max(activeTotal * 107 + 100, 400) }}>
                  <VirtualizedArticleGrid
                    articles={visibleArticles}
                    columns={3}
                    itemHeight={320}
                    gap={24}
                  />
                </div>
                <ListFooter
                  hasMore={activeHasMore}
                  loading={activeLoadingMore}
                  pageSize={9}
                  loaded={activeTotal}
                  total={activeTotalCount}
                  onLoadMore={loadMoreActive}
                />
              </>
            )}
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
              ref={forumRef}
              votedThread={votedThread}
              onVote={handleVote}
              onDeleteThread={handleDeleteThread}
              currentUserId={authUser?.id}
            />
          </div>  
        </>
      ))}

      {/* ===== ArtículoS GUARDADOS ===== */}
      {activeTab === "saved" && (
        <div className="space-y-6">
          <h2 className="font-display text-headline-lg text-on-surface flex items-center gap-3">
            <MaterialIcon name="bookmark" className="text-secondary" filled />
            Artículos Guardados
          </h2>
          {savedLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <MaterialIcon
                name="progress_activity"
                className="text-5xl text-outline-variant animate-spin mb-3"
              />
              <p className="text-on-surface-variant text-body-md">Cargando...</p>
            </div>
          ) : allSaved.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <MaterialIcon
                name="bookmark_border"
                className="text-5xl text-outline-variant mb-3"
              />
              <p className="text-on-surface-variant text-body-md mb-2">
                No tienes artículos guardados aún.
              </p>
              <p className="text-on-surface-variant text-body-sm">
                Usa el boton de guardar en cualquier artículo para verlo aqui.
              </p>
            </GlassCard>
          ) : (
            <>
              <div style={{ height: Math.max(savedTotal * 107 + 100, 400) }}>
                <VirtualizedArticleGrid
                  articles={allSaved}
                  columns={3}
                  itemHeight={280}
                  gap={24}
                  renderItem={(article, index, style) => (
                    <div key={article.id} style={style} className="w-full">
                      <GlassCard className="overflow-hidden h-full" hover glow>
                        {article.image_url && (
                          <div className="relative h-40 overflow-hidden">
                            <Image
                              src={article.image_url}
                              alt={article.title}
                              fill
                              className="object-cover"
                              unoptimized={article.image_url.startsWith("http://localhost:8000/uploads/")}
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
                                handleSubscribe(article.id);
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
              </div>
              <ListFooter
                hasMore={savedHasMore}
                loading={savedLoadingMore}
                pageSize={9}
                loaded={savedTotal}
                total={savedTotalCount}
                onLoadMore={loadMoreSaved}
              />
            </>
          )}
        </div>
      )}

      {/* Error state */}
      {loadError && !loading && (
        <div className="text-center py-16">
          <MaterialIcon name="cloud_off" className="text-error text-5xl block mb-3" />
          <p className="text-on-surface-variant text-body-md mb-4">{loadError}</p>
          <Button variant="secondary" onClick={retry}>
            Reintentar
          </Button>
        </div>
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
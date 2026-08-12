"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Article } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { Button, GlassCard, MaterialIcon, TabGroup } from "@/components/ui";
import {
  FeaturedArticle,
  AnnouncementsSidebar,
  ClassifiedsSidebar,
  ForumThreads,
  NewThreadModal,
  type ForumThreadsHandle,
} from "@/components/domain/News";
import { useNewsPage } from "@/hooks/useNewsPage";
import { NewsHeader } from "./components/NewsHeader";
import { SectionLoading } from "./components/SectionLoading";
import { MobileFeaturedCard } from "./components/MobileFeaturedCard";
import { MobileHeadlines } from "./components/MobileHeadlines";
import { ArticlesGrid } from "./components/ArticlesGrid";
import { SavedArticlesSection } from "./components/SavedArticlesSection";
import { useArticleActions } from "./hooks/useArticleActions";

export default function NewsPage() {
  const { user: authUser } = useAuthStore();
  const forumRef = useRef<ForumThreadsHandle>(null);

  const [filter, setFilter] = useState<"recent" | "featured">("recent");
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

  const { votedThread, vote, createThread, deleteThread, toggleSubscribe } = useArticleActions({
    authUser,
    articles: allArticles,
    featuredArticles,
    filter,
    activeTab,
    refreshArticles,
    refreshFeatured,
    refreshSaved,
    onThreadCreated: () => forumRef.current?.refresh(),
    onThreadDeleted: () => forumRef.current?.refresh(),
  });

  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
  }, []);

  // Orden: primero los pinned (fixed), y dentro de cada grupo los más recientes.
  const byPinnedThenDateDesc = useCallback(
    (a: Article, b: Article) => {
      const aPinned = a.pinned ? 1 : 0;
      const bPinned = b.pinned ? 1 : 0;
      if (aPinned !== bPinned) return bPinned - aPinned;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    },
    []
  );

  // El artículo principal es el fijado (pinned); si no hay ninguno, el más reciente.
  const mostRecent = useMemo(
    () => [...allArticles].sort(byPinnedThenDateDesc)[0],
    [allArticles, byPinnedThenDateDesc]
  );
  const featured = useMemo(
    () => allArticles.find((a) => a.pinned) ?? mostRecent,
    [allArticles, mostRecent]
  );

  // Cada pestaña tiene su propia lista paginada con lazy loading independiente.
  const isFeatured = filter === "featured";
  const activeItems = isFeatured ? featuredArticles : allArticles;
  const activeHasMore = isFeatured ? featuredHasMore : articlesHasMore;
  const activeLoadingMore = isFeatured ? featuredLoadingMore : articlesLoadingMore;
  const activeTotal = isFeatured ? featuredTotal : articlesTotal;
  const activeTotalCount = isFeatured ? featuredTotalCount : articlesTotalCount;
  const activeListLoading = isFeatured ? featuredLoading : false;
  const loadMoreActive = isFeatured ? loadMoreFeatured : loadMoreArticles;

  const sortedArticles = useMemo(
    () => [...activeItems].sort(byPinnedThenDateDesc),
    [activeItems, byPinnedThenDateDesc]
  );

  return (
    <div className="space-y-10 pb-16">
      <NewsHeader />

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
        <SectionLoading label="Cargando edición..." />
      ) : (
        <>
          {/* ===== DESKTOP: FEATURED + SIDEBAR ===== */}
          <div className="hidden md:grid grid-cols-1 md:grid-cols-12 gap-8">
            {/* Featured */}
            <div className="md:col-span-8">
              {featured ? (
                <FeaturedArticle article={featured} onSubscribe={toggleSubscribe} />
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
              <AnnouncementsSidebar announcements={allAnnouncements} loading={announcementsLoading} />
              <ClassifiedsSidebar classifieds={allClassifieds} loading={classifiedsLoading} />
            </div>
          </div>

          {/* ===== MOBILE: FEATURED CARD ===== */}
          <div className="md:hidden">
            <MobileFeaturedCard article={featured} />
          </div>

          {/* ===== MOBILE: BENTO HEADLINES ===== */}
          <MobileHeadlines articles={sortedArticles} />

          {/* ===== MOBILE: ANNOUNCEMENTS & CLASSIFIEDS ===== */}
          <div className="md:hidden space-y-6">
            <AnnouncementsSidebar announcements={allAnnouncements} loading={announcementsLoading} />
            <ClassifiedsSidebar classifieds={allClassifieds} loading={classifiedsLoading} />
          </div>

          {/* ===== DESKTOP: ALL ARTICLES GRID ===== */}
          <ArticlesGrid
            articles={sortedArticles}
            filter={filter}
            onFilterChange={setFilter}
            loading={activeListLoading}
            loadingMore={activeLoadingMore}
            hasMore={activeHasMore}
            total={activeTotal}
            totalCount={activeTotalCount}
            onLoadMore={loadMoreActive}
          />

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
              onVote={vote}
              onDeleteThread={deleteThread}
              currentUserId={authUser?.id}
            />
          </div>
        </>
      ))}

      {/* ===== ARTÍCULOS GUARDADOS ===== */}
      {activeTab === "saved" && (
        <SavedArticlesSection
          articles={allSaved}
          loading={savedLoading}
          loadingMore={savedLoadingMore}
          hasMore={savedHasMore}
          total={savedTotal}
          totalCount={savedTotalCount}
          onLoadMore={loadMoreSaved}
          onToggleSubscribe={toggleSubscribe}
        />
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
        onSubmit={createThread}
      />
    </div>
  );
}

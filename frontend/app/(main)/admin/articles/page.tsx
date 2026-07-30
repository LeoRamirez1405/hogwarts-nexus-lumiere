"use client";

import { useState, useEffect } from "react";
import { api, Article, Announcement, Classified } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import TabGroup from "@/components/ui/TabGroup";
import { ArticlesTab, AnnouncementsTab, ClassifiedsTab } from "@/components/domain/Admin";

const TABS = [
  { id: "articles", label: "Artículos", icon: "article" },
  { id: "announcements", label: "Anuncios", icon: "campaign" },
  { id: "classifieds", label: "Clasificados", icon: "sell" },
];

export default function AdminArticlesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("articles");

  const [articles, setArticles] = useState<Article[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [classifieds, setClassifieds] = useState<Classified[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    Promise.all([
      api.getArticles().then((p) => p.items),
      api.getAnnouncements().then((p) => p.items),
      api.getClassifieds().then((p) => p.items),
    ])
      .then(([a, ann, cls]) => {
        setArticles(a);
        setAnnouncements(ann);
        setClassifieds(cls);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  if (user?.role !== "admin") return null;

  const subtitle =
    activeTab === "articles"
      ? `${articles.length} artículos en El Quisquilloso`
      : activeTab === "announcements"
        ? `${announcements.length} anuncios activos`
        : `${classifieds.length} clasificados activos`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Gestionar El Quisquilloso
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            {subtitle}
          </p>
        </div>
      </div>

      {/* Desktop: tabs en una fila */}
      <div className="hidden md:block">
        <TabGroup tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />
      </div>

      {/* Mobile: Artículos arriba centrado, Anuncios+Clasificados abajo */}
      <div className="md:hidden space-y-3">
        <div className="flex justify-center">
          {(() => {
            const tab = TABS[0];
            const isActive = tab.id === activeTab;
            return (
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 rounded-full px-8 py-2 text-body-md font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {tab.icon && (
                  <span
                    className="material-symbols-outlined text-[1.1em]"
                    style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                  >
                    {tab.icon}
                  </span>
                )}
                {tab.label}
              </button>
            );
          })()}
        </div>
        <div className="flex gap-2">
          {TABS.slice(1).map((tab) => {
            const isActive = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-body-md font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-primary text-on-primary"
                    : "text-on-surface-variant hover:bg-surface-container-high"
                }`}
              >
                {tab.icon && (
                  <span
                    className="material-symbols-outlined text-[1.1em]"
                    style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                  >
                    {tab.icon}
                  </span>
                )}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-outline-variant/30 rounded w-1/3 mb-3" />
              <div className="h-3 bg-outline-variant/30 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {activeTab === "articles" && (
            <ArticlesTab
              articles={articles}
              setArticles={setArticles}
              search={search}
              setSearch={setSearch}
            />
          )}
          {activeTab === "announcements" && (
            <AnnouncementsTab
              announcements={announcements}
              setAnnouncements={setAnnouncements}
            />
          )}
          {activeTab === "classifieds" && (
            <ClassifiedsTab
              classifieds={classifieds}
              setClassifieds={setClassifieds}
            />
          )}
        </div>
      )}
    </div>
  );
}

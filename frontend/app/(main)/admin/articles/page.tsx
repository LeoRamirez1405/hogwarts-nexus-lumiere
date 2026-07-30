"use client";

import { useState, useEffect } from "react";
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user?.role !== "admin") return null;

  const subtitle =
    activeTab === "articles"
      ? "Gestiona los artículos de El Quisquilloso"
      : activeTab === "announcements"
        ? "Anuncios para El Quisquilloso"
        : "Clasificados de la comunidad";

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

      <div className="space-y-4">
        {activeTab === "articles" && (
          <ArticlesTab search={search} setSearch={setSearch} />
        )}
        {activeTab === "announcements" && <AnnouncementsTab />}
        {activeTab === "classifieds" && <ClassifiedsTab />}
      </div>
    </div>
  );
}

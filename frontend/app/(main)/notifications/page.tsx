"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Notification } from "@/lib/api";
import {
  notificationMeta,
  NOTIFICATION_CATEGORIES,
  type NotificationCategory,
} from "@/lib/notificationMeta";
import { GlassCard, MaterialIcon } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import { useNotificationStore } from "@/lib/notificationStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes <= 0) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString("es-ES");
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    notifications,
    loading,
    loaded,
    hasMore,
    loadingMore,
    load,
    loadMore,
    markRead,
    markAllRead,
  } = useNotificationStore();
  const [filter, setFilter] = useState<NotificationCategory | "all">("all");

  useEffect(() => {
    if (!user) return;
    // Refresh on entry so the full history is current; the store keeps this in
    // sync with the TopBar badge.
    load();
  }, [user, load]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const counts = useMemo(() => {
    const map: Record<string, number> = { all: notifications.length };
    for (const n of notifications) {
      const cat = notificationMeta(n.type).category;
      map[cat] = (map[cat] ?? 0) + 1;
    }
    return map;
  }, [notifications]);

  const visible = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => notificationMeta(n.type).category === filter);
  }, [notifications, filter]);

  const handleClick = async (notif: Notification) => {
    await markRead(notif.id);
    const dest = notificationMeta(notif.type).route(notif);
    if (dest) router.push(dest);
  };

  return (
    <PullToRefresh onRefresh={load}>
      <div className="max-w-3xl mx-auto pb-16 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary inline-flex items-center justify-center">
              <MaterialIcon name="notifications" className="text-2xl" filled />
            </div>
            <div>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary transition-colors mb-1"
              >
                <MaterialIcon name="arrow_back" className="text-[1.1em]" />
                Volver
              </Link>
              <h1 className="font-display text-headline-lg text-on-surface">
                Notificaciones
              </h1>
              <p className="text-label-sm text-on-surface-variant">
                {unreadCount > 0 ? `${unreadCount} sin leer` : "Todo al día"}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-label-md text-primary font-medium hover:underline whitespace-nowrap"
            >
              Marcar todo leído
            </button>
          )}
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-2">
          {NOTIFICATION_CATEGORIES.map((cat) => {
            const active = filter === cat.key;
            const count = counts[cat.key] ?? 0;
            return (
              <button
                key={cat.key}
                onClick={() => setFilter(cat.key)}
                className={`px-3.5 py-1.5 rounded-full text-label-md transition-colors border ${
                  active
                    ? "bg-primary text-on-primary border-primary"
                    : "bg-surface-container-low text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high"
                }`}
              >
                {cat.label}
                {count > 0 && (
                  <span className={active ? "opacity-80" : "text-on-surface-variant/50"}>
                    {" "}
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* List */}
        {loading || !loaded ? (
          <div className="py-20 text-center text-on-surface-variant">
            <MaterialIcon name="progress_activity" className="text-3xl animate-spin mb-2" />
            <p>Cargando...</p>
          </div>
        ) : visible.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <MaterialIcon name="notifications_off" className="text-5xl text-outline-variant mb-3" />
            <p className="text-on-surface-variant text-body-md">
              No tienes notificaciones aquí
            </p>
          </GlassCard>
        ) : (
          // Plain list, not virtualized: notifications are capped at 100 and a
          // simple list renders reliably everywhere (react-virtuoso frequently
          // measured a height of 0 in this layout and rendered no items).
          <div className="flex flex-col gap-2">
            {visible.map((n: Notification) => {
              const meta = notificationMeta(n.type);
              return (
                <div
                  key={n.id}
                  className={`w-full text-left flex items-start gap-3 p-4 rounded-2xl border transition-colors ${
                    n.read
                      ? "bg-surface-container-low border-outline-variant/20"
                      : "bg-primary/5 border-primary/20"
                  }`}
                >
                  <button
                    onClick={() => handleClick(n)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
                  >
                    <div className={`w-10 h-10 rounded-full inline-flex items-center justify-center flex-shrink-0 ${meta.chip}`}>
                      <MaterialIcon name={meta.icon} className="text-lg" filled={!n.read} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-body-md ${n.read ? "text-on-surface-variant" : "font-semibold text-on-surface"}`}>
                        {n.title}
                      </p>
                      <p className="text-label-sm text-on-surface-variant/70 mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-label-sm text-on-surface-variant/40 mt-1">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                  </button>
                  {!n.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors flex-shrink-0"
                      aria-label="Marcar como leida"
                      title="Marcar como leida"
                    >
                      <MaterialIcon name="check" className="text-lg" />
                    </button>
                  )}
                </div>
              );
            })}
            {hasMore && (
              <div className="pt-1 flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/10 text-primary text-label-md font-medium hover:bg-primary/20 transition-colors disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <MaterialIcon name="progress_activity" className="text-lg animate-spin" />
                      Cargando...
                    </>
                  ) : (
                    <>
                      <MaterialIcon name="expand_more" className="text-lg" />
                      Cargar más
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}

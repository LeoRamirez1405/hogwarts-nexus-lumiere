"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { api, Notification } from "@/lib/api";
import { notificationMeta } from "@/lib/notificationMeta";
import Avatar from "@/components/ui/Avatar";

interface TopBarProps {
  onMenuToggle?: () => void;
}

interface DesktopNavItem {
  label: string;
  href: string;
}

const desktopNavItems: DesktopNavItem[] = [
  { label: "Inicio", href: "/dashboard" },
  { label: "Perfil", href: "/profile" },
  { label: "Mensajes", href: "/messages" },
  { label: "Tesoro", href: "/treasury" },
  { label: "Prensa", href: "/news" },
  { label: "Mercado", href: "/marketplace/flourish-blotts" },
  { label: "Mascotas", href: "/pets" },
];

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

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(true);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const load = () => {
      api.getNotifications()
        .then((n) => {
          if (active) setNotifications(n);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoadingNotifs(false);
        });
    };
    load();
    // Light polling so fresh notifications trickle in without a page reload.
    const id = setInterval(load, 45000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadLabel = unreadCount > 99 ? "+99" : String(unreadCount);

  const handleNotificationClick = async (notif: Notification) => {
    if (!notif.read) {
      try {
        await api.markNotificationRead(notif.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
        );
      } catch {}
    }
    setShowNotifications(false);
    const dest = notificationMeta(notif.type).route(notif);
    if (dest) router.push(dest);
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm">
      <div className="h-16 lg:h-20 max-w-[1280px] mx-auto px-4 lg:px-10 flex justify-between items-center gap-2">
        {/* LEFT */}
        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 -ml-1 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
            aria-label="Toggle menu"
          >
            <MaterialIcon name="menu" className="text-2xl" />
          </button>
          <Link href="/dashboard" className="flex items-center min-w-0">
            <span className="font-display text-title-md sm:text-headline-lg text-primary tracking-tight truncate">
              Nexus Lumiere
            </span>
          </Link>
        </div>

        {/* CENTER: Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {desktopNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`py-2 text-body-md transition-colors ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant/70 hover:text-primary"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 shrink-0">
          {/* Wallet */}
          <div className="flex items-center gap-1.5 sm:gap-2 bg-surface-container-low px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border border-outline-variant/30">
            <MaterialIcon
              name="diamond"
              className="text-base sm:text-lg text-secondary"
              filled
            />
            <span className="text-label-md sm:text-body-md font-semibold text-on-surface">
              {user?.zerines?.toLocaleString() ?? "0"}
            </span>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors relative"
              aria-label="Notifications"
            >
              <MaterialIcon name="notifications" className="text-2xl" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 inline-flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full border-2 border-surface">
                  {unreadLabel}
                </span>
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-[min(20rem,calc(100vw-1.5rem))] z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
                  <h3 className="text-title-md font-display text-on-surface">
                    Notificaciones
                  </h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-label-sm text-primary font-medium hover:underline"
                    >
                      Marcar todo leido
                    </button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto no-scrollbar">
                  {loadingNotifs ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant">
                      <MaterialIcon name="progress_activity" className="text-2xl animate-spin mx-auto mb-2" />
                      Cargando...
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-on-surface-variant">
                      <MaterialIcon name="notifications_off" className="text-3xl mx-auto mb-2" />
                      <p className="text-body-md">Sin notificaciones</p>
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors w-full text-left ${
                          !n.read ? "bg-primary/5" : ""
                        }`}
                      >
                        <div
                          className={`w-9 h-9 inline-flex items-center justify-center rounded-full flex-shrink-0 ${notificationMeta(n.type).chip}`}
                        >
                          <MaterialIcon
                            name={notificationMeta(n.type).icon}
                            className="text-lg"
                            filled={!n.read}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-body-md ${
                              !n.read
                                ? "font-medium text-on-surface"
                                : "text-on-surface-variant"
                            }`}
                          >
                            {n.title}
                          </p>
                          <p className="text-label-sm text-on-surface-variant/60 mt-0.5 line-clamp-1">
                            {n.body}
                          </p>
                          <p className="text-label-sm text-on-surface-variant/40 mt-0.5">
                            hace {timeAgo(n.created_at)}
                          </p>
                        </div>
                        {!n.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
                <div className="border-t border-outline-variant/20 px-4 py-2.5">
                  <Link
                    href="/notifications"
                    onClick={() => setShowNotifications(false)}
                    className="block w-full text-center text-body-md text-primary font-medium hover:underline"
                  >
                    Ver todas
                  </Link>
                </div>
              </div>
            )}
          </div>

          {/* Avatar */}
          <Link href="/profile" className="flex-shrink-0">
            <Avatar
              src={user?.avatar_url ?? undefined}
              alt={user?.name ?? "Usuario"}
              size="sm"
              initials={user?.name?.charAt(0).toUpperCase() ?? "?"}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "ahora mismo";
  if (minutes < 60) return `hace ${minutes}m`;
  if (hours < 24) return `hace ${hours}h`;
  if (days < 7) return `hace ${days}d`;
  return date.toLocaleDateString("es-ES");
}

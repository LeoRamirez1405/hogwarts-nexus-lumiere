"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { Notification } from "@/lib/api";
import { useNotificationStore } from "@/lib/notificationStore";
import { notificationMeta, autoClearedByPath } from "@/lib/notificationMeta";
import { wsClient } from "@/lib/ws";
import { getAccessTokenFromCookie } from "@/lib/cookies";
import Avatar from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui";
import PWAInstallPrompt from "@/components/pwa/PWAInstallPrompt";
import { usePushSubscription } from "@/hooks/usePWA";
import { usePrefetchOnTouch } from "@/hooks/usePrefetchOnTouch";
import { useHapticLight } from "@/hooks/useHapticFeedback";
import { useBorginZone } from "@/hooks/useBorginZone";

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

function DesktopNavLink({ item, isActive, isDark }: { item: DesktopNavItem; isActive: boolean; isDark: boolean }) {
  const prefetchRef = usePrefetchOnTouch(item.href);
  return (
    <Link
      href={item.href}
      ref={prefetchRef}
      className={`py-2 text-body-md transition-colors ${
        isActive
          ? isDark
            ? "text-secondary-fixed font-bold border-b-2 border-secondary"
            : "text-primary font-bold border-b-2 border-primary"
          : isDark
            ? "text-surface-dim/70 hover:text-secondary-fixed"
            : "text-on-surface-variant/70 hover:text-primary"
      }`}
    >
      {item.label}
    </Link>
  );
}

function PushNotificationMenuItem() {
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription();
  const hapticLight = useHapticLight();

  const handleToggle = () => {
    hapticLight();
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className="w-full flex items-center gap-3 px-4 py-3 text-body-md hover:bg-surface-container-high transition-colors disabled:opacity-50"
      style={{ color: "var(--color-on-surface)" }}
    >
      <MaterialIcon
        name={isSubscribed ? "notifications_active" : "notifications_off"}
        className="text-lg"
        filled={isSubscribed}
      />
      <span className="flex-1 text-left">
        {isSubscribed ? "Notificaciones activadas" : "Activar notificaciones"}
      </span>
      {loading && <span className="text-label-sm text-on-surface-variant">...</span>}
    </button>
  );
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isBorgin = useBorginZone();
  const { user, logout } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifButtonRef = useRef<HTMLButtonElement>(null);
  const userMenuButtonRef = useRef<HTMLButtonElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const userMenuDropdownRef = useRef<HTMLDivElement>(null);
  const [notifPosition, setNotifPosition] = useState<{ top: number; right: number } | null>(null);
  const [userMenuPosition, setUserMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const hapticLight = useHapticLight();
  const {
    notifications,
    loading: loadingNotifs,
    load: loadNotifications,
    push: pushNotification,
    markRead,
    markAllRead,
    markReadMatching,
  } = useNotificationStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const notifOutside =
        (!notifMenuRef.current || !notifMenuRef.current.contains(target)) &&
        (!notifButtonRef.current || !notifButtonRef.current.contains(target));
      if (notifOutside) setShowNotifications(false);
      const userMenuOutside =
        (!userMenuDropdownRef.current || !userMenuDropdownRef.current.contains(target)) &&
        (!userMenuButtonRef.current || !userMenuButtonRef.current.contains(target));
      if (userMenuOutside) setShowUserMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    if (confirm("¿Seguro que quieres cerrar sesión?")) {
      logout();
      router.push("/login");
    }
  };

  useEffect(() => {
    if (!user) return;
    loadNotifications();
    // Realtime notifications arrive over the WebSocket when it is up. The REST
    // poll is kept only as a fallback for when the socket is down.
    const token = getAccessTokenFromCookie();
    if (token) wsClient.connect(token);
    const unsubNotif = wsClient.on("notification", (msg: { n?: Notification }) => {
      if (msg.n?.id) pushNotification(msg.n);
    });
    const unsubRefresh = wsClient.on("notification_refresh", () => {
      loadNotifications();
    });
    const id = setInterval(() => {
      if (!wsClient.isConnected()) loadNotifications();
    }, 45000);
    return () => {
      unsubNotif();
      unsubRefresh();
      clearInterval(id);
    };
  }, [user, loadNotifications, pushNotification]);

  // Auto-clear: reaching the place a notification points to marks it read,
  // even without clicking it. Messages are handled by the messages page itself.
  useEffect(() => {
    if (!user) return;
    markReadMatching((n) => autoClearedByPath(n, pathname));
  }, [user, pathname, notifications, markReadMatching]);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadLabel = unreadCount > 99 ? "+99" : String(unreadCount);

  const handleNotificationClick = async (notif: Notification) => {
    await markRead(notif.id);
    setShowNotifications(false);
    const dest = notificationMeta(notif.type).route(notif);
    if (dest) router.push(dest);
  };

  const markAllAsRead = async () => {
    await markAllRead();
  };

  return (
    <header
      role="banner"
      className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-xl border-b shadow-sm ${
        isBorgin
          ? "bg-[#1c1b1b]/85 border-secondary/20"
          : "bg-surface/80 border-outline-variant/30"
      }`}
    >
      <div className="h-16 lg:h-20 max-w-[1280px] mx-auto px-4 lg:px-10 flex justify-between items-center gap-2">
        {/* LEFT */}
        <div className="flex items-center gap-1.5 sm:gap-4 min-w-0">
          <button
            onClick={() => { hapticLight(); onMenuToggle?.(); }}
            className={`lg:hidden p-2 -ml-1 rounded-xl transition-colors shrink-0 ${
              isBorgin
                ? "text-surface-dim hover:bg-inverse-surface"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
            aria-label="Toggle menu"
          >
            <MaterialIcon name="menu" className="text-2xl" />
          </button>
          <Link href="/dashboard" className="flex items-center min-w-0">
            <span
              className={`font-display text-title-md sm:text-headline-lg tracking-tight truncate ${
                isBorgin ? "text-secondary-fixed" : "text-primary"
              }`}
            >
              Nexus Lumière  
            </span>
          </Link>
        </div>

        {/* CENTER: Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {desktopNavItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <DesktopNavLink key={item.href} item={item} isActive={isActive} isDark={isBorgin} />
            );
          })}
        </nav>

        {/* RIGHT */}
        <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 shrink-0">
          {/* Wallet */}
          <div
            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-full border ${
              isBorgin
                ? "bg-inverse-surface border-secondary/20"
                : "bg-surface-container-low border-outline-variant/30"
            }`}
          >
            <MaterialIcon
              name="diamond"
              className="text-base sm:text-lg text-secondary"
              filled
              inline
            />
            <span
              className={`text-label-md sm:text-body-md font-semibold ${
                isBorgin ? "text-surface" : "text-on-surface"
              }`}
            >
              {user?.zerines?.toLocaleString() ?? "0"}
            </span>
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              ref={notifButtonRef}
              onClick={() => {
                hapticLight();
                if (!showNotifications && notifButtonRef.current) {
                  const r = notifButtonRef.current.getBoundingClientRect();
                  setNotifPosition({ top: r.bottom + 8, right: window.innerWidth - r.right });
                }
                setShowNotifications(!showNotifications);
              }}
              className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors relative ${
                isBorgin
                  ? "text-surface-dim hover:bg-inverse-surface"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              aria-label="Notifications"
            >
              <MaterialIcon name="notifications" className="text-2xl" />
              {unreadCount > 0 && (
                <span
                  className={`absolute -top-0.5 -right-0.5 min-w-4.5 h-4.5 px-1 inline-flex items-center justify-center bg-error text-white text-[10px] font-bold rounded-full border-2 ${
                    isBorgin ? "border-[#1c1b1b]" : "border-surface"
                  }`}
                >
                  {unreadLabel}
                </span>
              )}
            </button>
          </div>

          {/* Avatar + user menu */}
          <div className="relative shrink-0" ref={userMenuRef}>
            <button
              ref={userMenuButtonRef}
              onClick={() => {
                hapticLight();
                if (!showUserMenu && userMenuButtonRef.current) {
                  const r = userMenuButtonRef.current.getBoundingClientRect();
                  setUserMenuPosition({ top: r.bottom + 8, right: window.innerWidth - r.right });
                }
                setShowUserMenu((v) => !v);
              }}
              className="flex items-center gap-2 rounded-full hover:opacity-80 transition-opacity"
            >
              <Avatar
                src={user?.avatar_url ?? undefined}
                alt={user?.name ?? "Usuario"}
                size="sm"
                initials={user?.name?.charAt(0).toUpperCase() ?? "?"}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Notifications dropdown — portal to escape header stacking context */}
      {showNotifications && notifPosition && createPortal(
        <div
          ref={notifMenuRef}
          className="fixed bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-[min(20rem,calc(100vw-1.5rem))] z-70 overflow-hidden"
          style={{ top: notifPosition.top, right: notifPosition.right }}
        >
          <div className="px-4 py-3 border-b border-outline-variant/20 flex items-center justify-between">
            <h3 className="text-title-md font-display text-on-surface">
              Notificaciones
            </h3>
            {unreadCount > 0 && (
              <button
                onClick={() => { hapticLight(); markAllAsRead(); }}
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
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors w-full text-left ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <button
                    onClick={() => handleNotificationClick(n)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div
                      className={`w-9 h-9 inline-flex items-center justify-center rounded-full shrink-0 ${notificationMeta(n.type).chip}`}
                    >
                      <MaterialIcon
                        name={notificationMeta(n.type).icon}
                        className="text-lg"
                        filled={!n.read}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-body-md ${!n.read ? "font-medium text-on-surface" : "text-on-surface-variant"}`}
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
                  </button>
                  {!n.read && (
                    <button
                      onClick={(e) => { e.stopPropagation(); hapticLight(); markRead(n.id); }}
                      className="w-8 h-8 inline-flex items-center justify-center rounded-full text-primary hover:bg-primary/10 transition-colors shrink-0"
                      aria-label="Marcar como leida"
                      title="Marcar como leida"
                    >
                      <MaterialIcon name="check" className="text-lg" />
                    </button>
                  )}
                </div>
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
        </div>,
        document.body
      )}

      {/* User menu dropdown — portal to escape header stacking context */}
      {showUserMenu && userMenuPosition && createPortal(
        <div
          ref={userMenuDropdownRef}
          className="fixed w-56 bg-surface rounded-2xl shadow-xl border border-outline-variant/20 overflow-hidden z-70"
          style={{ top: userMenuPosition.top, right: userMenuPosition.right }}
        >
          <div className="px-4 py-3 border-b border-outline-variant/20">
            <p className="font-display text-body-md text-on-surface truncate">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-label-sm text-on-surface-variant truncate">
              {user?.email}
            </p>
          </div>
          <Link
            href="/profile"
            onClick={() => setShowUserMenu(false)}
            className="flex items-center gap-3 px-4 py-3 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <MaterialIcon name="person" className="text-lg" />
            Mi Perfil
          </Link>
          <div className="border-t border-outline-variant/20">
            <PWAInstallPrompt variant="row" />
          </div>
          <div className="border-t border-outline-variant/20">
            <PushNotificationMenuItem />
          </div>
          <button
            onClick={() => { hapticLight(); handleLogout(); }}
            className="w-full flex items-center gap-3 px-4 py-3 text-body-md text-error hover:bg-error/10 transition-colors"
          >
            <MaterialIcon name="logout" className="text-lg" />
            Cerrar sesion
          </button>
        </div>,
        document.body
      )}
    </header>
  );
}

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

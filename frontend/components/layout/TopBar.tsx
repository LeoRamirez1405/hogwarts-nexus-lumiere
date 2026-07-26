"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
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

interface Notification {
  id: string;
  text: string;
  time: string;
  icon: string;
  read: boolean;
  href: string;
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

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", text: "Luna Lovegood te envio un mensaje", time: "2m", icon: "mail", read: false, href: "/messages" },
    { id: "2", text: "Cedric Diggory reactuvo a tu publicacion", time: "15m", icon: "favorite", read: false, href: "/profile" },
    { id: "3", text: "Tu criatura esta hambrienta", time: "1h", icon: "pets", read: true, href: "/pets" },
    { id: "4", text: "Nuevo articulo en El Quisquilloso", time: "3h", icon: "article", read: true, href: "/news" },
  ]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleNotificationClick = (notif: Notification) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    );
    setShowNotifications(false);
    router.push(notif.href);
  };

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/30 shadow-sm">
      <div className="h-16 xl:h-20 max-w-[1280px] mx-auto px-4 xl:px-10 flex justify-between items-center">
        {/* LEFT */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuToggle}
            className="md:hidden p-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Toggle menu"
          >
            <MaterialIcon name="menu" className="text-2xl" />
          </button>
          <Link href="/dashboard" className="flex items-center">
            <span className="font-display text-headline-lg xl:text-headline-lg text-primary tracking-tight">
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
        <div className="flex items-center gap-4">
          {/* Wallet */}
          <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-full border border-outline-variant/30">
            <MaterialIcon
              name="diamond"
              className="text-lg text-secondary"
              filled
            />
            <span className="text-body-md font-semibold text-on-surface">
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
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-surface" />
              )}
            </button>
            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 w-80 z-50 overflow-hidden">
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
                  {notifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-surface-container-high transition-colors w-full text-left ${
                        !n.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div
                        className={`w-9 h-9 inline-flex items-center justify-center rounded-full flex-shrink-0 ${
                          !n.read
                            ? "bg-primary/10 text-primary"
                            : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        <MaterialIcon name={n.icon} className="text-lg" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-body-md ${
                            !n.read
                              ? "font-medium text-on-surface"
                              : "text-on-surface-variant"
                          }`}
                        >
                          {n.text}
                        </p>
                        <p className="text-label-sm text-on-surface-variant/60 mt-0.5">
                          hace {n.time}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="border-t border-outline-variant/20 px-4 py-2.5">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      markAllAsRead();
                    }}
                    className="w-full text-center text-body-md text-primary font-medium hover:underline"
                  >
                    Ver todas
                  </button>
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { User } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { usePrefetchOnTouch } from "@/hooks/usePrefetchOnTouch";
import { useBorginZone } from "@/hooks/useBorginZone";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  icon: string;
  label: string;
  href: string;
  mobileHidden?: boolean;
}

const mainNavItems: NavItem[] = [
  { icon: "home", label: "Inicio", href: "/dashboard" },
  { icon: "person", label: "Perfil", href: "/profile" },
  { icon: "mail", label: "La Lechuza", href: "/messages" },
  { icon: "account_balance", label: "Cámara del Tesoro", href: "/treasury" },
  { icon: "newspaper", label: "El Quisquilloso", href: "/news" },
  {
    icon: "auto_stories",
    label: "Flourish & Blotts",
    href: "/marketplace/flourish-blotts",
  },
  {
    icon: "auto_fix_high",
    label: "Borgin & Burkes",
    href: "/marketplace/borgin-burkes",
  },
  { icon: "pets", label: "Pet Sanctuary", href: "/pets" },
];

const adminNavItems: NavItem[] = [
  { icon: "group", label: "Usuarios", href: "/admin/users" },
  { icon: "inventory_2", label: "Productos", href: "/admin/products" },
  { icon: "article", label: "Artículos", href: "/admin/articles" },
  { icon: "pets", label: "Criaturas", href: "/admin/creatures" },
  { icon: "nutrition", label: "Comida y Juguetes", href: "/admin/pet-items" },
  { icon: "groups", label: "Gestión de Grupos", href: "/admin/groups" },
  {
    icon: "receipt_long",
    label: "Transacciones",
    href: "/admin/transactions",
  },
  { icon: "settings", label: "Configuración", href: "/admin/settings" },
];

function NavLink({
  item,
  isActive,
  isDark,
  onNavigate,
}: {
  item: NavItem;
  isActive: boolean;
  isDark: boolean;
  onNavigate?: () => void;
}) {
  const prefetchRef = usePrefetchOnTouch(item.href);
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      ref={prefetchRef}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center gap-4 py-3 px-8 rounded-xl mx-4 transition-all duration-200 hover:translate-x-1 ${
        isActive
          ? "sidebar-active"
          : isDark
            ? "text-surface-dim hover:bg-inverse-surface"
            : "text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      <MaterialIcon
        name={item.icon}
        className="text-xl"
        filled={isActive}
      />
      <span className="text-body-md whitespace-nowrap">{item.label}</span>
   </Link>
  );
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const isBorgin = useBorginZone();

  const asideClasses = `fixed left-0 top-0 z-40 w-72 max-w-[85vw] border-r pt-[var(--topbar-h)] pb-[var(--bottomnav-h)] ${
    isBorgin ? "bg-[#1c1b1b] border-secondary/15" : "bg-surface border-outline-variant/30"
  }`;

  return (
    <>
    {/* Mobile / tablet drawer sidebar (below lg) */}
    <aside
      role="navigation"
      aria-label="Navegación principal"
      className={`${asideClasses} h-screen transform transition-transform duration-300 lg:hidden ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="flex flex-col h-full">
        <SidebarContent pathname={pathname} isAdmin={isAdmin} isDark={isBorgin} user={user} onNavigate={onClose} />
      </div>
    </aside>

    {/* Desktop fixed sidebar (lg+) */}
    <aside
      role="navigation"
      aria-label="Navegación principal"
      className={`${asideClasses} hidden lg:flex h-screen flex-col`}
    >
      <div className="flex flex-col h-full">
        <SidebarContent pathname={pathname} isAdmin={isAdmin} isDark={isBorgin} user={user} />
      </div>
    </aside>
  </>
  );
}

function SidebarContent({
  pathname,
  isAdmin,
  isDark,
  user,
  onNavigate,
}: {
  pathname: string;
  isAdmin: boolean;
  isDark: boolean;
  user: User | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    confirmDialog({
      title: "Cerrar sesión",
      message: "¿Seguro que quieres cerrar sesión?",
      icon: "logout",
      variant: "secondary",
      confirmLabel: "Cerrar sesión",
      cancelLabel: "Cancelar",
      onConfirm: () => {
        logout();
        router.push("/login");
      },
    });
  };

  return (
    <>
      {/* TOP: User info */}
      <div className="px-8 py-6">
        <div className="flex items-center gap-4 min-w-0">
          <Avatar
            src={user?.avatar_url ?? undefined}
            alt={user?.name ?? "Usuario"}
            size="sm"
            initials={user?.name?.charAt(0).toUpperCase() ?? "?"}
            className="flex-shrink-0"
          />
          <div className="min-w-0">
            <p
              className={`font-display text-headline-lg leading-tight truncate ${
                isDark ? "text-secondary-fixed" : "text-primary"
              }`}
            >
              {user?.name ?? "Usuario"}
            </p>
            <p
              className={`text-label-sm truncate ${
                isDark ? "text-surface-dim" : "text-on-surface-variant"
              }`}
            >
              {user?.house ?? "Sin casa"}
            </p>
          </div>
        </div>
      </div>

      {/* MIDDLE: Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <li key={item.href} className={item.mobileHidden ? "max-lg:hidden" : ""}>
              <NavLink
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                isDark={isDark}
                onNavigate={onNavigate}
              />
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div className="mt-6">
            <p
              className={`px-8 mb-2 text-label-sm font-semibold uppercase tracking-wider ${
                isDark ? "text-surface-dim" : "text-on-surface-variant"
              }`}
            >
              Administracion
            </p>
            <ul className="space-y-1">
              {adminNavItems.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                    isDark={isDark}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* BOTTOM: Settings, Support, Admin button */}
      <div className="px-4 pb-[var(--bottomnav-h)] space-y-1">
        <Link
          href="/support"
          onClick={onNavigate}
          className={`flex items-center gap-4 py-3 px-8 rounded-xl mx-0 transition-all duration-200 hover:translate-x-1 ${
            isDark
              ? "text-surface-dim hover:bg-inverse-surface"
              : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <MaterialIcon name="help" className="text-xl" />
          <span className="text-body-md">Soporte</span>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-4 py-3 px-8 text-error hover:bg-error/10 rounded-xl mx-0 transition-all duration-200 hover:translate-x-1"
        >
          <MaterialIcon name="logout" className="text-xl" />
          <span className="text-body-md">Cerrar sesión</span>
        </button>
      </div>
    </>
  );
}
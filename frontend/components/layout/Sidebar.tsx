"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { User } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface NavItem {
  icon: string;
  label: string;
  href: string;
}

const mainNavItems: NavItem[] = [
  { icon: "home", label: "Inicio", href: "/dashboard" },
  { icon: "person", label: "Perfil", href: "/profile" },
  { icon: "mail", label: "Bandeja de Entrada", href: "/messages" },
  { icon: "account_balance", label: "Camara del Tesoro", href: "/treasury" },
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
  { icon: "pets", label: "Santuario de Mascotas", href: "/pets" },
];

const adminNavItems: NavItem[] = [
  { icon: "group", label: "Usuarios", href: "/admin/users" },
  { icon: "inventory_2", label: "Productos", href: "/admin/products" },
  { icon: "article", label: "Articulos", href: "/admin/articles" },
  { icon: "pets", label: "Criaturas", href: "/admin/creatures" },
  { icon: "nutrition", label: "Comida y Juguetes", href: "/admin/pet-items" },
  { icon: "groups", label: "Gestión de Grupos", href: "/admin/groups" },
  {
    icon: "receipt_long",
    label: "Transacciones",
    href: "/admin/transactions",
  },
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

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  return (
    <Link
      href={item.href}
      className={`flex items-center gap-4 py-3 px-8 rounded-xl mx-4 transition-all duration-200 hover:translate-x-1 ${
        isActive
          ? "sidebar-active"
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

export default function Sidebar({ isOpen = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";

  return (
    <>
      {/* Mobile sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-72 bg-surface border-r border-outline-variant/30 pt-20 transform transition-transform duration-300 xl:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <SidebarContent pathname={pathname} isAdmin={isAdmin} user={user} />
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden xl:flex fixed left-0 top-0 z-40 h-screen w-72 bg-surface border-r border-outline-variant/30 pt-20 flex-col">
        <div className="flex flex-col h-full">
          <SidebarContent pathname={pathname} isAdmin={isAdmin} user={user} />
        </div>
      </aside>
    </>
  );
}

function SidebarContent({
  pathname,
  isAdmin,
  user,
}: {
  pathname: string;
  isAdmin: boolean;
  user: User | null;
}) {
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
            <p className="font-display text-headline-lg text-primary leading-tight truncate">
              {user?.name ?? "Usuario"}
            </p>
            <p className="text-on-surface-variant text-label-sm truncate">
              {user?.house ?? "Sin casa"}
            </p>
          </div>
        </div>
      </div>

      {/* MIDDLE: Nav items */}
      <nav className="flex-1 overflow-y-auto py-2">
        <ul className="space-y-1">
          {mainNavItems.map((item) => (
            <li key={item.href}>
              <NavLink
                item={item}
                isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
              />
            </li>
          ))}
        </ul>

        {isAdmin && (
          <div className="mt-6">
            <p className="px-8 mb-2 text-label-sm font-semibold text-on-surface-variant uppercase tracking-wider">
              Administracion
            </p>
            <ul className="space-y-1">
              {adminNavItems.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    isActive={pathname === item.href || pathname.startsWith(item.href + "/")}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </nav>

      {/* BOTTOM: Settings, Support, Admin button */}
      <div className="px-4 pb-6 space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-4 py-3 px-8 text-on-surface-variant hover:bg-surface-container-high rounded-xl mx-0 transition-all duration-200 hover:translate-x-1"
        >
          <MaterialIcon name="settings" className="text-xl" />
          <span className="text-body-md">Configuracion</span>
        </Link>
        <Link
          href="/support"
          className="flex items-center gap-4 py-3 px-8 text-on-surface-variant hover:bg-surface-container-high rounded-xl mx-0 transition-all duration-200 hover:translate-x-1"
        >
          <MaterialIcon name="help" className="text-xl" />
          <span className="text-body-md">Soporte</span>
        </Link>

      </div>
    </>
  );
}

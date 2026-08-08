"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui";
import { usePrefetchOnTouch } from "@/hooks/usePrefetchOnTouch";
import { useHapticSelection } from "@/hooks/useHapticFeedback";
import { useBorginZone } from "@/hooks/useBorginZone";

interface TabItem {
  icon: string;
  label: string;
  href: string;
}

const tabs: TabItem[] = [
  { icon: "home", label: "Inicio", href: "/dashboard" },
  { icon: "account_balance", label: "Bóveda", href: "/treasury" },
  { icon: "collections_bookmark", label: "Catálogos", href: "/catalogs" },
  { icon: "pets", label: "Mascotas", href: "/pets" },
  { icon: "newspaper", label: "Prensa", href: "/news" },
  { icon: "person", label: "Perfil", href: "/profile" },
];

function BottomNavTab({ tab, isActive, isDark, onSelect }: { tab: TabItem; isActive: boolean; isDark: boolean; onSelect: () => void }) {
  const prefetchRef = usePrefetchOnTouch(tab.href);
  return (
    <Link
      href={tab.href}
      ref={prefetchRef}
      onClick={onSelect}
      className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 touch-target min-h-[44px] min-w-[44px] ${
        isActive
          ? isDark
            ? "text-secondary-fixed bg-secondary/20 rounded-full px-4 py-1"
            : "text-primary bg-secondary-container/40 rounded-full px-4 py-1"
          : isDark
            ? "text-surface-dim/60 hover:text-secondary-fixed"
            : "text-outline hover:text-primary"
      }`}
    >
      <MaterialIcon
        name={tab.icon}
        className={`text-2xl ${isActive ? (isDark ? "text-secondary-fixed" : "text-primary") : ""}`}
        filled={isActive}
      />
      <span
        className={`text-[10px] leading-none ${
          isActive ? (isDark ? "font-bold text-secondary-fixed" : "font-bold text-primary") : ""
        }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const hapticSelection = useHapticSelection();
  const isBorgin = useBorginZone();

  return (
    <nav
      role="navigation"
      aria-label="Navegación inferior"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 backdrop-blur-xl border-t shadow-lg rounded-t-xl pb-safe ${
        isBorgin
          ? "bg-[#1c1b1b]/90 border-secondary/15"
          : "bg-surface/90 border-outline-variant/20"
      }`}
    >
      <div className="flex justify-around items-center h-16 px-2">
{tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <BottomNavTab
                key={tab.href}
                tab={tab}
                isActive={isActive}
                isDark={isBorgin}
                onSelect={hapticSelection}
              />
            );
          })}
      </div>
    </nav>
  );
}
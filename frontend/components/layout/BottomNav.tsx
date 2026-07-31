"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MaterialIcon } from "@/components/ui";

interface TabItem {
  icon: string;
  label: string;
  href: string;
}

const tabs: TabItem[] = [
  { icon: "home", label: "Inicio", href: "/dashboard" },
  { icon: "account_balance", label: "Bóveda", href: "/treasury" },
  { icon: "pets", label: "Mascotas", href: "/pets" },
  { icon: "newspaper", label: "Prensa", href: "/news" },
  { icon: "person", label: "Perfil", href: "/profile" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/20 shadow-lg rounded-t-xl pb-safe">
      <div className="flex justify-around items-center h-16 px-2">
        {tabs.map((tab) => {
          const isActive =
            pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center justify-center gap-0.5 transition-all duration-200 ${
                isActive
                  ? "text-primary bg-secondary-container/40 rounded-full px-4 py-1"
                  : "text-outline hover:text-primary"
              }`}
            >
              <MaterialIcon
                name={tab.icon}
                className={`text-2xl ${isActive ? "text-primary" : ""}`}
                filled={isActive}
              />
              <span
                className={`text-[10px] leading-none ${
                  isActive ? "font-bold text-primary" : ""
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

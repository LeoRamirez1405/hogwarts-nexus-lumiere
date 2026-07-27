"use client";

import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";

const quickNavItems = [
  { label: "Mensajes", icon: "mail", href: "/messages" },
  { label: "Borgin & Burkes", icon: "storefront", href: "/marketplace/borgin-burkes" },
  { label: "Flourish & Blotts", icon: "menu_book", href: "/marketplace/flourish-blotts" },
  { label: "Tesoro", icon: "account_balance", href: "/treasury" },
  { label: "El Quisquilloso", icon: "article", href: "/news" },
  { label: "Mascotas", icon: "pets", href: "/pets" },
];

export function QuickNav() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
      {quickNavItems.map((item) => (
        <Link key={item.label} href={item.href}>
          <GlassCard className="p-6 text-center hover:-translate-y-1 transition-transform cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
              <MaterialIcon name={item.icon} className="text-2xl" />
            </div>
            <p className="font-display text-body-md text-on-surface">{item.label}</p>
          </GlassCard>
        </Link>
      ))}
    </div>
  );
}
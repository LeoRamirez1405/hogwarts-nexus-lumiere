"use client";

import Link from "next/link";
import { useRef } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";
import { useSwipeable, useReducedMotion } from "@/hooks/useGestures";
import { usePrefetchOnTouch } from "@/hooks/usePrefetchOnTouch";

const quickNavItems = [
  { label: "Mensajes", icon: "mail", href: "/messages" },
  { label: "Borgin & Burkes", icon: "storefront", href: "/marketplace/borgin-burkes" },
  { label: "Flourish & Blotts", icon: "menu_book", href: "/marketplace/flourish-blotts" },
  { label: "Tesoro", icon: "account_balance", href: "/treasury" },
  { label: "El Quisquilloso", icon: "article", href: "/news" },
  { label: "Mascotas", icon: "pets", href: "/pets" },
];

export function QuickNav() {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useSwipeable({
    onSwipeLeft: () => scrollRef.current?.scrollBy({ left: 200, behavior: prefersReducedMotion ? "auto" : "smooth" }),
    onSwipeRight: () => scrollRef.current?.scrollBy({ left: -200, behavior: prefersReducedMotion ? "auto" : "smooth" }),
    threshold: 30,
    disabled: prefersReducedMotion,
  });

  return (
    <>
      {/* Mobile: horizontal scroll chips */}
      <div
        ref={scrollRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className="flex lg:hidden gap-3 overflow-x-auto pb-2 -mx-4 px-4 mb-8 snap-x"
      >
        {quickNavItems.map((item) => (
          <QuickNavChip key={item.label} item={item} />
        ))}
     </div>

      {/* Desktop: grid layout */}
      <div className="hidden lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        {quickNavItems.map((item) => (
          <QuickNavCard key={item.label} item={item} />
        ))}
     </div>
    </>
  );
}

function QuickNavChip({ item }: { item: (typeof quickNavItems)[number] }) {
  const prefetchRef = usePrefetchOnTouch(item.href);
  return (
    <Link
      key={item.label}
      href={item.href}
      ref={prefetchRef}
      className="snap-start shrink-0"
    >
      <GlassCard className="flex items-center gap-3 px-4 py-3 hover:-translate-y-0.5 transition-transform cursor-pointer" aria-pressed="false">
        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MaterialIcon name={item.icon} className="text-xl" />
       </div>
        <span className="font-display text-body-sm text-on-surface whitespace-nowrap">
          {item.label}
       </span>
     </GlassCard>
   </Link>
  );
}

function QuickNavCard({ item }: { item: (typeof quickNavItems)[number] }) {
  const prefetchRef = usePrefetchOnTouch(item.href);
  return (
    <Link key={item.label} href={item.href} ref={prefetchRef}>
      <GlassCard className="p-6 text-center hover:-translate-y-1 transition-transform cursor-pointer" aria-pressed="false">
        <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
          <MaterialIcon name={item.icon} className="text-2xl" />
       </div>
        <p className="font-display text-body-md text-on-surface">{item.label}</p>
     </GlassCard>
   </Link>
  );
}
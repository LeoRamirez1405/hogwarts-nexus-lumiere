"use client";

import { DashboardData } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";
import { formatAmount } from "./DashboardUtils";

export function PersonalStats({ data }: { data: DashboardData }) {
  const stats = [
    { label: "Publicaciones", value: data.my_posts ?? 0, icon: "article", bg: "bg-primary/10 text-primary" },
    { label: "Mascotas", value: data.my_creatures ?? 0, icon: "pets", bg: "bg-secondary/10 text-secondary" },
    { label: "Zerines", value: data.zerines ?? 0, icon: "diamond", bg: "crystal-gradient inner-glow-gold text-on-primary" },
    { label: "Likes recibidos", value: data.total_likes_received ?? 0, icon: "thumb_up", bg: "bg-tertiary/10 text-tertiary" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 mb-6">
      {stats.map((stat) => (
        <GlassCard key={stat.label} glow className="overflow-hidden">
          <div className="p-5 text-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-3 ${stat.bg}`}>
              <MaterialIcon name={stat.icon} className="text-xl" />
            </div>
            <p className="font-display text-headline-lg text-on-surface">{formatAmount(stat.value)}</p>
            <p className="text-label-sm text-on-surface-variant mt-1">{stat.label}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
"use client";

import { MaterialIcon } from "@/components/ui";

interface StatsCardsProps {
  postsCount: number;
  friendsCount: number;
  zerines: number;
  memberSince: string;
}

export function StatsCards({ postsCount, friendsCount, zerines, memberSince }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="glass-card rounded-2xl p-4 text-center">
        <MaterialIcon name="article" className="text-primary text-2xl mb-1" filled={false} />
        <p className="font-display text-title-md text-on-surface">{postsCount}</p>
        <p className="text-label-sm text-on-surface-variant">Publicaciones</p>
      </div>
      <div className="glass-card rounded-2xl p-4 text-center">
        <MaterialIcon name="group" className="text-secondary text-2xl mb-1" filled={false} />
        <p className="font-display text-title-md text-on-surface">{friendsCount}</p>
        <p className="text-label-sm text-on-surface-variant">Amigos</p>
      </div>
      <div className="glass-card rounded-2xl p-4 text-center">
        <MaterialIcon name="diamond" className="text-secondary text-2xl mb-1" filled={true} />
        <p className="font-display text-title-md text-secondary">{zerines.toLocaleString()}</p>
        <p className="text-label-sm text-on-surface-variant">Zerines</p>
      </div>
      <div className="glass-card rounded-2xl p-4 text-center">
        <MaterialIcon name="calendar_today" className="text-success text-2xl mb-1" filled={false} />
        <p className="font-display text-title-md text-on-surface">{memberSince}</p>
        <p className="text-label-sm text-on-surface-variant">Se unio</p>
      </div>
    </div>
  );
}
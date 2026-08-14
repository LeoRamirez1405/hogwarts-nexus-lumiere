"use client";

import { Avatar, GlassCard, ProgressBar } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import type { Leaderboard } from "@/lib/api";

const RANK_STYLE = [
  "bg-[#c9a227] text-surface",
  "bg-outline-variant text-on-surface-variant",
  "bg-[#8a63c9] text-surface",
];

export function Leaderboard({ data }: { data: Leaderboard }) {
  const { user } = useAuthStore();
  const entries = data.entries.slice(0, 10);

  if (entries.length === 0) {
    return (
      <p className="text-sm text-outline">
        Todavía no hay coleccionistas en esta edición.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-outline">
        Top {entries.length} de {data.total_participants} participantes.
      </p>
      {entries.map((entry, i) => {
        const isMe = entry.user_id === user?.id;
        return (
          <GlassCard
            key={entry.user_id}
            className={`flex items-center gap-3 p-3 ${isMe ? "ring-1 ring-secondary" : ""}`}
          >
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                RANK_STYLE[i] ?? "bg-primary/10 text-primary"
              }`}
            >
              {i + 1}
            </span>
            <Avatar src={entry.avatar_url ?? undefined} alt={entry.name} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-primary">
                {entry.name}
                {isMe && <span className="ml-1 text-[10px] text-secondary">(tú)</span>}
                {entry.first_completed && (
                  <span
                    className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#c9a227]/25 px-1.5 py-0.5 text-[9px] font-bold text-[#8a6d00]"
                    title="Primer completador"
                  >
                    <span className="material-symbols-outlined text-[11px]">military_tech</span>
                    Primero
                  </span>
                )}
              </p>
              <ProgressBar value={entry.percent} size="sm" />
            </div>
            <span className="shrink-0 font-mono text-xs text-outline">
              {entry.progress}
            </span>
          </GlassCard>
        );
      })}
    </div>
  );
}
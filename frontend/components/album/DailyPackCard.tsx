"use client";

import { useEffect, useState } from "react";
import { Button, GlassCard } from "@/components/ui";
import { useDailyPack } from "@/hooks/useDailyPack";

function nextIn(target: string): string {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return "ya";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DailyPackCard({ onClaimed }: { onClaimed?: () => void }) {
  const { status, claiming, claim } = useDailyPack();
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, []);

  if (!status) return null;

  const available = status.available;

  return (
    <GlassCard className="flex items-center gap-3 p-4">
      <span className="material-symbols-outlined text-3xl text-secondary">
        calendar_today
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-primary">Sobre de Lechuza diario</p>
        <p className="text-[11px] text-outline">
          {available
            ? "Uno gratis por día, amarrado a tus inicios de sesión."
            : `Vuelve en ${nextIn(status.next_claim_at ?? "")}.`}
        </p>
      </div>
      <Button
        size="sm"
        disabled={!available || claiming}
        onClick={async () => {
          const pack = await claim();
          if (pack) onClaimed?.();
        }}
      >
        <span className="material-symbols-outlined mr-1 text-base">redeem</span>
        {claiming ? "Reclamando…" : available ? "Reclamar" : "Espera"}
      </Button>
    </GlassCard>
  );
}
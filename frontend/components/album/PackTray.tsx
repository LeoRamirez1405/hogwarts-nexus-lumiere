"use client";

import { Button, GlassCard } from "@/components/ui";
import type { UserPack } from "@/lib/api";

const ORIGIN_LABEL: Record<string, { icon: string; label: string }> = {
  purchase: { icon: "shopping_bag", label: "Comprado" },
  reward: { icon: "redeem", label: "Regalo" },
  roulette: { icon: "casino", label: "Ruleta" },
  exchange: { icon: "swap_horiz", label: "Canje" },
  daily: { icon: "calendar_today", label: "Diario" },
};

interface PackTrayProps {
  tray: UserPack[];
  loading: boolean;
  opening: boolean;
  batchOpening: boolean;
  onOpen: (pack: UserPack) => void;
  onOpenAll: () => void;
}

export function PackTray({ tray, loading, opening, batchOpening, onOpen, onOpenAll }: PackTrayProps) {
  const unopened = tray.filter((p) => !p.opened).length;

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-primary">Mi bandeja de sobres</h2>
        {unopened > 0 && (
          <Button variant="outline" size="sm" disabled={opening || batchOpening} onClick={onOpenAll}>
            <span className="material-symbols-outlined mr-1 text-base">auto_awesome_mosaic</span>
            {batchOpening ? "Abriendo…" : `Abrir todos (${unopened})`}
          </Button>
        )}
      </div>
      {!loading && tray.length === 0 && (
        <p className="text-sm text-outline">
          No tienes sobres pendientes. ¡Compra uno o gíralo en la ruleta!
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tray.map((pack) => {
          const origin = ORIGIN_LABEL[pack.origin] ?? { icon: "mail", label: pack.origin };
          return (
            <GlassCard key={pack.id} className="flex flex-col items-center p-4">
              <span className="material-symbols-outlined text-4xl text-primary">
                {origin.icon}
              </span>
              <p className="mt-1 text-sm font-semibold text-primary">{pack.pack_type_name}</p>
              <p className="text-[11px] text-outline">
                {origin.label} · {new Date(pack.created_at).toLocaleDateString()}
              </p>
              <Button
                className="mt-3 w-full"
                size="sm"
                disabled={opening}
                onClick={() => onOpen(pack)}
              >
                <span className="material-symbols-outlined mr-1 text-base">auto_awesome</span>
                Abrir
              </Button>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
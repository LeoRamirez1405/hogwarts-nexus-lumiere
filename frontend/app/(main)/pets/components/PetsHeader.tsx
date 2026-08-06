"use client";

import { MaterialIcon } from "@/components/ui";
import type { PetsHeaderProps } from "./types";

export const PetsHeader = ({ stats, user }: PetsHeaderProps) => {
  return (
    <div className="max-w-7xl mx-auto mb-10">
      <div className="bg-primary-fixed/30 border border-primary/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <MaterialIcon name="pets" className="text-primary text-3xl" filled />
            <span className="text-primary text-label-sm uppercase tracking-[0.2em]">Hogwarts</span>
          </div>
          <h1 className="font-display text-headline-lg md:text-display-lg text-primary mb-2">
            Pet Sanctuary
          </h1>
          <p className="text-on-surface-variant text-body-md mb-6 max-w-xl">
            Cuida a tus compañeros: con el tiempo tendrán hambre y necesitarán cariño. Sube su nivel, haz crecer tu santuario y comercia mascotas.
          </p>

          <div className="flex flex-wrap gap-4">
            {/* Sanctuary level */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-violet-500/20 min-w-52.5">
              <MaterialIcon name="castle" className="text-violet-600 text-[1.6em]" filled />
              <div className="flex-1">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Santuario</p>
                <p className="text-title-md font-bold text-on-surface leading-tight">
                  Nivel {stats?.sanctuary_level ?? 0}
                  <span className="text-label-sm text-on-surface-variant font-normal"> / {stats?.sanctuary_max ?? 23}</span>
                </p>
                <div className="h-1.5 bg-violet-500/15 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${stats?.sanctuary_progress.percent ?? 0}%` }} />
                </div>
              </div>
            </div>
            {/* User level */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-amber-500/20 min-w-52.5">
              <MaterialIcon name="military_tech" className="text-amber-600 text-[1.6em]" filled />
              <div className="flex-1">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Nivel Mágico</p>
                <p className="text-title-md font-bold text-on-surface leading-tight">
                  {stats?.user_level_name ?? "—"}
                  <span className="text-label-sm text-on-surface-variant font-normal"> · Nv {stats?.user_level ?? 1}</span>
                </p>
                <div className="h-1.5 bg-amber-500/15 rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.round((stats?.user_progress ?? 0) * 100)}%` }} />
                </div>
              </div>
            </div>
            {/* Zerines */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3 border border-secondary/10">
              <MaterialIcon name="diamond" className="text-secondary text-[1.4em]" filled />
              <div>
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Zerines</p>
                <p className="text-title-md font-bold text-on-surface">{user?.zerines?.toLocaleString() ?? "0"}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
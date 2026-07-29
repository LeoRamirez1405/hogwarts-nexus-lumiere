"use client";

import { MaterialIcon } from "@/components/ui";

interface CrystalHeroProps {
  balance: number;
  loading: boolean;
}

export function CrystalHero({ balance, loading }: CrystalHeroProps) {
  return (
    <div className="crystal-gradient rounded-2xl overflow-hidden relative">
      <div className="absolute inset-0 inner-sparkle" />
      <div className="relative z-10 p-10 md:p-16 text-center text-on-primary">
        <div className="mb-3">
          <span className="text-label-sm uppercase tracking-[0.2em] opacity-70">
            Cámara del Tesoro
          </span>
        </div>
        <div className="font-display text-6xl md:text-7xl flex items-center justify-center gap-4 mb-4">
          <span className="text-5xl md:text-6xl">💎</span>
          <span>{loading ? "---" : balance.toLocaleString()}</span>
        </div>
        <p className="text-label-sm uppercase tracking-wider opacity-70">
          Zerines Disponibles
        </p>
        <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
          <MaterialIcon name="shield" className="text-sm" filled />
          <span className="text-label-sm text-on-primary/80">Transacciones seguras y encriptadas</span>
        </div>
      </div>
    </div>
  );
}
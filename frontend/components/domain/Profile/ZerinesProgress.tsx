"use client";

import { MaterialIcon } from "@/components/ui";

interface ZerinesProgressProps {
  zerines: number;
}

export function ZerinesProgress({ zerines }: ZerinesProgressProps) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon name="diamond" className="text-secondary" filled={true} />
        <h3 className="text-title-md font-display text-on-surface">Zerines</h3>
      </div>
      <div className="text-center">
        <p className="text-headline-lg font-display text-secondary">{zerines.toLocaleString()}</p>
        <p className="text-label-sm text-on-surface-variant">Saldo disponible</p>
      </div>
    </div>
  );
}

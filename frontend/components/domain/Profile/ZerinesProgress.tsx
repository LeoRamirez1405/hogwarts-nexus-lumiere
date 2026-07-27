"use client";

import { MaterialIcon, ProgressBar } from "@/components/ui";

interface ZerinesProgressProps {
  zerines: number;
  nextLevelThreshold?: number;
}

export function ZerinesProgress({ zerines, nextLevelThreshold = 2000 }: ZerinesProgressProps) {
  return (
    <div className="glass-card rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <MaterialIcon name="diamond" className="text-secondary" filled={true} />
        <h3 className="text-title-md font-display text-on-surface">Zerines</h3>
      </div>
      <div className="text-center mb-4">
        <p className="text-headline-lg font-display text-secondary">{zerines.toLocaleString()}</p>
        <p className="text-label-sm text-on-surface-variant">
          de {nextLevelThreshold.toLocaleString()} para proximo nivel
        </p>
      </div>
      <ProgressBar value={zerines} max={nextLevelThreshold} color="secondary" showValue />
    </div>
  );
}
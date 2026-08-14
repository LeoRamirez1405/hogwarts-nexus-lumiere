"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui";

function diffParts(target: string) {
  const ms = new Date(target).getTime() - Date.now();
  if (ms <= 0) return null;
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return { d, h, m };
}

export function Countdown({ endsAt, compact }: { endsAt: string; compact?: boolean }) {
  const [parts, setParts] = useState(() => diffParts(endsAt));

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(endsAt)), 30000);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!parts) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-semibold text-secondary">
        <MaterialIcon name="schedule" className="text-sm" />
        Cerrado
      </span>
    );
  }

  const text = compact
    ? `${parts.d > 0 ? `${parts.d}d ` : ""}${parts.h}h ${parts.m}m`
    : `${parts.d} días ${parts.h}h ${parts.m}m`;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary/15 px-2.5 py-1 text-xs font-semibold text-secondary">
      <MaterialIcon name="schedule" className="text-sm" />
      Cierra en {text}
    </span>
  );
}
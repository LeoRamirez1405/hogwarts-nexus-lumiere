"use client";

import { MaterialIcon } from "@/components/ui";

interface SectionLoadingProps {
  label?: string;
  className?: string;
}

export function SectionLoading({ label = "Cargando...", className = "py-20" }: SectionLoadingProps) {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <MaterialIcon
        name="progress_activity"
        className="text-5xl text-outline-variant animate-spin mb-3"
      />
      <p className="text-on-surface-variant text-body-md">{label}</p>
    </div>
  );
}

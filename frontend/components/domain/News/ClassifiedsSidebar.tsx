"use client";

import { MaterialIcon, Badge, GlassCard } from "@/components/ui";
import { Classified } from "@/lib/api";

interface ClassifiedsSidebarProps {
  classifieds: Classified[];
  loading?: boolean;
}

export function ClassifiedsSidebar({ classifieds, loading }: ClassifiedsSidebarProps) {
  return (
    <GlassCard className="p-5">
      <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
        <MaterialIcon name="sell" className="text-primary text-xl" />
        Clasificados
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <MaterialIcon
            name="progress_activity"
            className="text-2xl text-outline-variant animate-spin"
          />
        </div>
      ) : (
        <div className="space-y-3">
          {classifieds.map((ad) => (
            <div
              key={ad.id}
              className="flex items-center justify-between py-2 border-b border-outline-variant/10 last:border-0"
            >
              <span className="text-label-sm text-on-surface font-medium">
                {ad.title}
              </span>
              <Badge variant="tag" color="secondary">
                {ad.price}
              </Badge>
            </div>
          ))}
          {classifieds.length === 0 && (
            <p className="text-label-sm text-on-surface-variant/50 italic py-2">
              No hay clasificados
            </p>
          )}
        </div>
      )}
    </GlassCard>
  );
}
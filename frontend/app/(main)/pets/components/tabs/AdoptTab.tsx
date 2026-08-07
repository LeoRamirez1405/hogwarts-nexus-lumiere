"use client";

import { MaterialIcon } from "@/components/ui";
import { Button } from "@/components/ui";
import { ErrorBoundary } from "@/components/ui";
import { CreatureCard } from "@/components/domain/Pets";
import type { AdoptTabProps } from "../types";
import Skeleton from "@/components/ui/Skeleton";

export const AdoptTab = ({
  creatures,
  loading,
  loadError,
  adoptedIds,
  stats,
  adopting,
  userZerines,
  onAdopt,
  onViewDetails,
  onRetry,
}: AdoptTabProps) => {
  if (loadError && !loading) {
    return (
      <div className="text-center py-16">
        <MaterialIcon name="cloud_off" className="text-error text-5xl block mb-3" />
        <p className="text-on-surface-variant text-body-md mb-4">{loadError}</p>
        <Button variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {creatures.map((creature) => {
          const isAdopted = adoptedIds.has(creature.id);
          const meets = stats
            ? stats.user_level >= (creature.required_user_level || 1) &&
              stats.sanctuary_level >= (creature.required_sanctuary_level || 0)
            : true;
          return (
            <CreatureCard
              key={creature.id}
              creature={creature}
              isAdopted={isAdopted}
              meetsRequirements={meets}
              stats={stats}
              onAdopt={() => onAdopt(creature)}
              adopting={adopting === creature.id}
              userZerines={userZerines}
              onViewDetails={onViewDetails}
            />
          );
        })}
      </div>
    </ErrorBoundary>
  );
};
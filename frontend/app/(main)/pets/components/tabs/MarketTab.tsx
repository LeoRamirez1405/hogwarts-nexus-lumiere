"use client";

import { MaterialIcon } from "@/components/ui";
import { Button } from "@/components/ui";
import { MarketCreatureCard } from "@/components/domain/Pets";
import type { MarketTabProps } from "../types";
import Skeleton from "@/components/ui/Skeleton";

export const MarketTab = ({
  market,
  loading,
  loadingMore,
  hasMore,
  buyingPet,
  userZerines,
  stats,
  onBuy,
  onViewDetails,
  onLoadMore,
}: MarketTabProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} variant="card" />)}
      </div>
    );
  }

  if (market.length === 0) {
    return (
      <div className="text-center py-20">
        <MaterialIcon name="storefront" className="text-on-surface-variant text-6xl block mb-4" />
        <p className="text-on-surface-variant text-body-md">Nadie ha puesto mascotas en venta ahora mismo.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {market.map((m) => {
          const meets = stats && m.creature
            ? stats.user_level >= (m.creature.required_user_level || 1) &&
              stats.sanctuary_level >= (m.creature.required_sanctuary_level || 0)
            : true;
          return (
            <MarketCreatureCard
              key={m.id}
              market={m}
              meetsRequirements={meets}
              onBuy={() => onBuy(m)}
              buying={buyingPet === m.id}
              userZerines={userZerines}
              onViewDetails={onViewDetails}
            />
          );
        })}
      </div>

      {hasMore && (
        <div className="flex justify-center mt-8">
          <Button variant="secondary" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Cargando..." : "Cargar más"}
          </Button>
        </div>
      )}
    </>
  );
};
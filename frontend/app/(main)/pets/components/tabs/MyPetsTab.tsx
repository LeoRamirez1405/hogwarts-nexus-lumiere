"use client";

import { MaterialIcon } from "@/components/ui";
import { Button } from "@/components/ui";
import { PetCard } from "@/components/domain/Pets";
import { MOOD_META } from "../types";
import type { MyPetsTabProps } from "../types";

export const MyPetsTab = ({
  myCreatures,
  loading,
  loadingMore,
  hasMore,
  inventory,
  picker,
  using,
  sellFor,
  sellPrice,
  showMarket,
  onToggleFeed,
  onTogglePlay,
  onUse,
  onListForSale,
  onUnlist,
  onToggleSale,
  onGoToShop,
  onLoadMore,
  setSellPrice,
}: MyPetsTabProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white border border-outline-variant/30 rounded-3xl p-6 animate-pulse">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-full bg-surface-container-high" />
              <div className="space-y-2">
                <div className="h-4 bg-surface-container-high rounded w-24" />
                <div className="h-3 bg-surface-container-high rounded w-20" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="h-8 bg-surface-container-high rounded" />
              <div className="h-8 bg-surface-container-high rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (myCreatures.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <button
          onClick={onGoToShop}
          className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors"
        >
          <MaterialIcon name="add" className="text-on-surface-variant text-4xl mb-2" />
          <p className="text-on-surface-variant text-body-md">Adopta tu primera criatura</p>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {myCreatures.map((uc) => {
          const petType = uc.creature?.pet_type ?? "Criaturas pequeñas";
          const mood = MOOD_META[uc.mood] ?? MOOD_META.bien;
          const isFeedOpen = picker?.ucId === uc.id && picker.mode === "feed";
          const isPlayOpen = picker?.ucId === uc.id && picker.mode === "play";

          const foods = inventory
            .filter((r) => r.quantity > 0 && r.pet_item?.kind === "food" && r.pet_item?.pet_type === petType);
          const toys = inventory
            .filter((r) => r.quantity > 0 && r.pet_item?.kind === "toy" && r.pet_item?.pet_type === petType);

          return (
            <PetCard
              key={uc.id}
              uc={uc}
              petType={petType}
              mood={mood}
              isFeedOpen={isFeedOpen}
              isPlayOpen={isPlayOpen}
              foods={foods}
              toys={toys}
              onToggleFeed={() => onToggleFeed(uc.id)}
              onTogglePlay={() => onTogglePlay(uc.id)}
              onUse={onUse}
              onListForSale={onListForSale}
              onUnlist={onUnlist}
              onToggleSale={onToggleSale}
              onGoToShop={onGoToShop}
              sellFor={sellFor}
              sellPrice={sellPrice}
              setSellPrice={setSellPrice}
              using={using}
              showMarket={showMarket}
            />
          );
        })}

        <button
          onClick={onGoToShop}
          className="border-2 border-dashed border-outline-variant/50 rounded-3xl flex flex-col items-center justify-center py-16 cursor-pointer hover:border-primary/30 transition-colors"
        >
          <MaterialIcon name="add" className="text-on-surface-variant text-4xl mb-2" />
          <p className="text-on-surface-variant text-body-md">Adoptar otra criatura</p>
        </button>
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
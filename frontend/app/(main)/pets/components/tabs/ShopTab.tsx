"use client";

import { ShopSection } from "@/components/domain/Pets";
import type { ShopTabProps, PetType } from "../types";
import Skeleton from "@/components/ui/Skeleton";

export const ShopTab = ({
  petItems,
  inventory,
  loading,
  buying,
  shopType,
  petTypeValues,
  onShopTypeChange,
  onBuy,
  onViewDetails,
}: ShopTabProps) => {
  const shopItems = shopType === "all" ? petItems : petItems.filter((i) => i.pet_type === shopType);
  const shopFoods = shopItems.filter((i) => i.kind === "food");
  const shopToys = shopItems.filter((i) => i.kind === "toy");

  const typeOptions: (PetType | "all")[] = ["all", ...petTypeValues.map((v) => v.label as PetType)];

  return (
    <>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-headline-lg text-primary">
          Tienda de Mascotas
        </h2>
        <div className="flex flex-wrap gap-2">
          {typeOptions.map((t) => (
            <button
              key={t}
              onClick={() => onShopTypeChange(t)}
              className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                shopType === t
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {t === "all" ? "Todos" : t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} variant="card" />)}
        </div>
      ) : (
        <div className="space-y-10">
          <ShopSection
            title="Comida"
            icon="nutrition"
            items={shopFoods}
            inventory={inventory}
            buying={buying}
            onBuy={onBuy}
            onViewDetails={onViewDetails}
            statLabel="hambre"
          />
          <ShopSection
            title="Juguetes"
            icon="toys"
            items={shopToys}
            inventory={inventory}
            buying={buying}
            onBuy={onBuy}
            onViewDetails={onViewDetails}
            statLabel="felicidad"
          />
        </div>
      )}
    </>
  );
};
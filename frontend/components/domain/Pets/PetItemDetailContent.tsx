"use client";

import { memo } from "react";
import Image from "next/image";
import { PetItem, PetItemKind, PetType } from "@/lib/api";
import { MaterialIcon, ZerineDisplay, Button } from "@/components/ui";

interface PetItemDetailContentProps {
  item: PetItem;
  inventoryQuantity?: number;
  onBuy: (item: PetItem) => void;
  buying?: boolean;
  statLabel: string;
}

const KIND_LABELS: Record<PetItemKind, string> = {
  food: "Comida",
  toy: "Juguete",
};

const KIND_ICONS: Record<PetItemKind, string> = {
  food: "restaurant",
  toy: "sports_esports",
};

const KIND_COLORS: Record<PetItemKind, string> = {
  food: "text-success",
  toy: "text-primary",
};

const PET_TYPE_COLORS: Record<PetType, string> = {
  Aves: "bg-blue/10 text-blue",
  Bestias: "bg-amber/10 text-amber",
  "Criaturas pequeñas": "bg-pink/10 text-pink",
};

export const PetItemDetailContent = memo(function PetItemDetailContent({
  item,
  inventoryQuantity = 0,
  onBuy,
  buying,
  statLabel,
}: PetItemDetailContentProps) {
  const kindLabel = KIND_LABELS[item.kind] || item.kind;
  const kindIcon = KIND_ICONS[item.kind] || "inventory";
  const kindColor = KIND_COLORS[item.kind] || "text-on-surface";
  const petTypeColor = PET_TYPE_COLORS[item.pet_type] || "bg-surface-container-high/50 text-on-surface";

  return (
    <div className="space-y-5">
      {item.image_url && (
        <div className="relative h-56 rounded-2xl overflow-hidden">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            unoptimized={item.image_url.startsWith("http://localhost:8000/uploads/") || item.image_url.startsWith("/fallbacks/")}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center text-label-sm px-3 py-1 rounded-full ${petTypeColor}`}>
            {item.pet_type}
          </span>
          <span className={`inline-flex items-center text-label-sm px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant ${kindColor}`}>
            {kindLabel}
          </span>
          {item.pack_size > 1 && (
            <span className="inline-flex items-center text-label-sm px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
              Lote x{item.pack_size}
            </span>
          )}
        </div>

        <h2 className="font-display text-headline-md text-on-surface">{item.name}</h2>

        <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
          {item.description || "Sin descripción disponible."}
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/30">
          <div className="flex items-center gap-2 text-label-sm">
            <MaterialIcon name={kindIcon} className={kindColor} filled />
            <span className="font-medium">{kindLabel}</span>
          </div>
          <div className="flex items-center gap-2 text-label-sm">
            <MaterialIcon name="category" className="text-on-surface-variant" />
            <span>{item.pet_type}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-outline-variant/30">
          <div>
            <p className="text-on-surface-variant text-sm">Restaura</p>
            <p className="font-semibold text-on-surface flex items-center gap-1">
              <MaterialIcon name="add_circle" className="text-success text-[1.1em]" filled />
              +{item.restore_amount} {statLabel}
            </p>
          </div>
          <div>
            <p className="text-on-surface-variant text-sm">Usos por lote</p>
            <p className="font-semibold text-on-surface">{item.pack_size}</p>
          </div>
        </div>

        {inventoryQuantity > 0 && (
          <div className="pt-2 border-t border-outline-variant/30">
            <p className="text-on-surface-variant text-sm">En tu inventario</p>
            <p className="font-semibold text-on-surface flex items-center gap-2">
              <MaterialIcon name="inventory_2" className="text-secondary" filled />
              {inventoryQuantity}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
          <ZerineDisplay amount={item.price} iconStyle="icon" variant="price" />
          <Button
            onClick={() => onBuy(item)}
            disabled={buying}
            className="w-auto"
          >
            {buying ? "..." : "Comprar"}
          </Button>
        </div>
      </div>
    </div>
  );
});
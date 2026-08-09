"use client";

import Image from "next/image";
import { MaterialIcon, Badge, ZerineDisplay, Button } from "@/components/ui";
import { PetItem, UserPetItem } from "@/lib/api";

interface ShopSectionProps {
  title?: string;
  icon?: string;
  items: PetItem[];
  inventory: UserPetItem[];
  buying: string | null;
  onBuy: (item: PetItem) => void;
  onViewDetails?: (item: PetItem) => void;
  statLabel: string;
}

export function ShopSection({
  title,
  icon,
  items,
  inventory,
  buying,
  onBuy,
  onViewDetails,
  statLabel,
}: ShopSectionProps) {
  if (items.length === 0) return null;
  const ownedQty = (id: string) => inventory.find((r) => r.pet_item_id === id)?.quantity ?? 0;
  return (
    <div className="mt-6">
      {(title || icon) && (
        <div className="flex items-center gap-2 mb-4">
          {icon && <MaterialIcon name={icon} className="text-primary text-2xl" />}
          {title && <h3 className="font-display text-title-lg text-on-surface">{title}</h3>}
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((item) => {
          const owned = ownedQty(item.id);
          return (
            <div
              key={item.id}
              className="glass-card rounded-2xl p-5 flex flex-col cursor-pointer hover:-translate-y-1 transition-transform duration-200"
              onClick={() => onViewDetails?.(item)}
            >
              {item.image_url && (
                <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden mb-3 bg-surface-container-low">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized={item.image_url.startsWith("http://localhost:8000/uploads/") || item.image_url.startsWith("/fallbacks/")}
                  />
                </div>
              )}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Badge variant="tag" color="secondary">
                    {item.pet_type}
                  </Badge>
                  {item.pack_size > 1 && (
                    <Badge variant="tag" color="default">
                      Lote x{item.pack_size}
                    </Badge>
                  )}
                </div>
                {owned > 0 && (
                  <span className="text-label-sm text-on-surface-variant">Tienes: {owned}</span>
                )}
              </div>
              <h4 className="font-display text-title-sm text-on-surface mb-1">{item.name}</h4>
              <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3 flex-1">{item.description}</p>
              <div className="flex items-center gap-3 mb-3 text-label-sm">
                <span className="flex items-center gap-1 text-success font-medium">
                  <MaterialIcon name="add_circle" className="text-[1.1em]" filled />
                  +{item.restore_amount} {statLabel}
                </span>
                {item.pack_size > 1 && <span className="text-on-surface-variant">{item.pack_size} usos</span>}
              </div>
              <div className="flex items-center justify-between">
                <ZerineDisplay amount={item.price} iconStyle="icon" variant="price" />
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    onBuy(item);
                  }}
                  disabled={buying === item.id}
                  className="hover:opacity-90 transition-all active:scale-95 disabled:opacity-50"
                >
                  {buying === item.id ? "..." : "Comprar"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
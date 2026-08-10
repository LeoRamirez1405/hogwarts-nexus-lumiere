"use client";

import { MaterialIcon } from "@/components/ui";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import type { UserProductAdmin } from "@/lib/api";

interface InventoryCardsProps {
  items: UserProductAdmin[];
  onRemove: (item: UserProductAdmin) => void;
  loading?: boolean;
}

export default function InventoryCards({ items, onRemove, loading }: InventoryCardsProps) {
  if (items.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <MaterialIcon name="inventory_2" className="text-4xl text-on-surface-variant mx-auto mb-4" />
        <h3 className="text-title-md text-on-surface mb-2">Sin inventario</h3>
        <p className="text-body-md text-on-surface-variant">No hay elementos que coincidan con los filtros.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <GlassCard key={item.id} className="p-4 gap-3" variant="tinted">
          <div
            className="flex items-start gap-3 cursor-pointer"
            onClick={() => onRemove(item)}
            title="Ver detalles y retirar"
          >
            {item.product.image_url && (
              <Image
                src={item.product.image_url}
                alt={item.product.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                unoptimized={isStoredUpload(item.product.image_url)}
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-body-md text-on-surface truncate">{item.product.name}</h4>
                <Badge
                  variant="tag"
                  color={item.product.shop === "borgin" ? "default" : "primary"}
                >
                  {item.product.shop === "borgin" ? "Borgin" : "Flourish"}
                </Badge>
              </div>
              <p className="text-label-sm text-on-surface-variant truncate">{item.product.category || "Sin categoría"}</p>
              <div className="flex items-center gap-3 mt-2 text-body-sm text-on-surface-variant">
                <span className="font-mono tabular-nums flex items-center gap-1">
                  {item.product.price}
                  <MaterialIcon name="diamond" filled className="text-xs" inline />
                </span>
                <span className="font-mono tabular-nums">
                  x{item.quantity}
                </span>
              </div>
              <p className="text-label-sm text-on-surface-variant mt-1">
                {new Date(item.purchased_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-outline-variant/10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-body-xs">
                {item.user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-body-sm text-on-surface truncate max-w-[150px]">{item.user.name}</p>
                <p className="text-label-sm text-on-surface-variant truncate max-w-[150px]">{item.user.email}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              icon="remove_circle_outline"
              iconPosition="left"
              onClick={() => onRemove(item)}
              disabled={loading}
              className="text-error hover:bg-error/10"
            >
              Retirar
            </Button>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
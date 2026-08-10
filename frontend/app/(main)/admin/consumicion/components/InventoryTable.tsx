"use client";

import { MaterialIcon } from "@/components/ui";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import Badge from "@/components/ui/Badge";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import type { UserProductAdmin } from "@/lib/api";

interface InventoryTableProps {
  items: UserProductAdmin[];
  onRemove: (item: UserProductAdmin) => void;
  loading?: boolean;
}

export default function InventoryTable({ items, onRemove, loading }: InventoryTableProps) {
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
    <GlassCard className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant/20 bg-surface-container-high/50">
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Usuario</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Producto</th>
              <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">Cantidad</th>
              <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">Precio unit.</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Marketplace</th>
              <th className="px-4 py-3 text-left text-label-md font-medium text-on-surface-variant">Fecha compra</th>
              <th className="px-4 py-3 text-right text-label-md font-medium text-on-surface-variant">Acción</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                onClick={() => onRemove(item)}
                className="border-b border-outline-variant/10 hover:bg-surface-container-high/30 transition-colors cursor-pointer"
                title="Ver detalles y retirar"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium text-body-sm"
                    >
                      {item.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-body-md text-on-surface">{item.user.name}</p>
                      <p className="text-label-sm text-on-surface-variant">{item.user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {item.product.image_url && (
                      <Image
                        src={item.product.image_url}
                        alt={item.product.name}
                        width={40}
                        height={40}
                        className="w-10 h-10 rounded-lg object-cover"
                        unoptimized={isStoredUpload(item.product.image_url)}
                      />
                    )}
                    <div>
                      <p className="text-body-md text-on-surface">{item.product.name}</p>
                      <p className="text-label-sm text-on-surface-variant">
                        {item.product.category || "Sin categoría"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-body-md text-on-surface font-mono tabular-nums">
                    {item.quantity}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-body-md text-on-surface font-mono tabular-nums flex items-center justify-end gap-1">
                    {item.product.price}
                    <MaterialIcon name="diamond" filled className="text-sm" inline />
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Badge
                    variant="tag"
                    color={item.product.shop === "borgin" ? "default" : "primary"}
                  >
                    {item.product.shop === "borgin" ? "Borgin & Burkes" : "Flourish & Blotts"}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <span className="text-body-sm text-on-surface-variant">
                    {new Date(item.purchased_at).toLocaleDateString("es-ES", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="remove_circle_outline"
                    iconPosition="left"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item);
                    }}
                    disabled={loading}
                    className="text-error hover:bg-error/10"
                  >
                    Retirar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
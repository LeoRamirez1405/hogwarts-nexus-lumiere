"use client";

import { MaterialIcon } from "@/components/ui";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui";
import { ZerineDisplay } from "@/components/ui";
import type { BuyMarketModalProps } from "../types";

export const BuyMarketModal = ({
  marketCreature,
  buyingPet,
  userZerines,
  onClose,
  onConfirm,
}: BuyMarketModalProps) => {
  if (!marketCreature) return null;

  return (
    <Modal open onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <MaterialIcon name="storefront" className="text-primary text-2xl" filled />
          <h2 className="font-display text-headline-lg text-on-surface">
            Comprar a {marketCreature.pet_name || marketCreature.creature?.name || "esta mascota"}
          </h2>
        </div>
        <p className="text-on-surface-variant text-body-md">
          Vas a comprar a {marketCreature.pet_name || marketCreature.creature?.name || "esta mascota"} (Nv {marketCreature.level} · {marketCreature.level_name}) de {marketCreature.seller_name}.
        </p>
        <div className="flex items-center justify-center py-4">
          <ZerineDisplay amount={marketCreature.sale_price} variant="price" />
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={buyingPet === marketCreature.id || userZerines < marketCreature.sale_price}
            onClick={onConfirm}
            className="flex-1"
          >
            {buyingPet === marketCreature.id ? "Comprando..." : "Confirmar compra"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
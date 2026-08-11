"use client";

import { MaterialIcon } from "@/components/ui";
import { Modal, Button, ZerineDisplay, BottomSheet } from "@/components/ui";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";
import type { BuyMarketModalProps } from "../types";

export const BuyMarketModal = ({
  marketCreature,
  buyingPet,
  userZerines,
  onClose,
  onConfirm,
}: BuyMarketModalProps) => {
  const isDesktop = useIsDesktopMdUp(false);

  if (!marketCreature) return null;

  const title = `Comprar a ${marketCreature.pet_name || marketCreature.creature?.name || "esta mascota"}`;

  const renderBody = () => (
    <div className={isDesktop ? "p-6 space-y-5" : "space-y-5"}>
      {isDesktop && (
        <div className="flex items-center gap-3 mb-1">
          <MaterialIcon name="storefront" className="text-primary text-2xl" filled />
          <h2 className="font-display text-headline-lg text-on-surface">
            {title}
          </h2>
        </div>
      )}
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
  );

  if (isDesktop) {
    return (
      <Modal open onClose={onClose}>
        {renderBody()}
      </Modal>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title={title}>
      {renderBody()}
    </BottomSheet>
  );
};
"use client";

import { useState } from "react";
import { Product } from "@/lib/api";
import { DetailModal } from "@/components/ui/DetailModal";
import { Button, MaterialIcon } from "@/components/ui";

interface SpecificationModalProps {
  open: boolean;
  product: Product | null;
  onConfirm: (specification: string) => void;
  onCancel: () => void;
}

export function SpecificationModal({
  open,
  product,
  onConfirm,
  onCancel,
}: SpecificationModalProps) {
  const [value, setValue] = useState("");
  const placeholder =
    product?.specification_placeholder?.trim() || "Especifica los detalles del producto";

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (!trimmed || !product) return;
    onConfirm(trimmed);
    setValue("");
  };

  const handleCancel = () => {
    setValue("");
    onCancel();
  };

  if (!product) return null;

  return (
    <DetailModal open={open} onClose={handleCancel} title="Especificacion requerida" size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 inline-flex items-center justify-center">
            <MaterialIcon name="edit_note" className="text-primary" />
          </div>
          <div>
            <h3 className="font-display text-title-md text-on-surface">{product.name}</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              Antes de agregarlo al carrito, indica la especificacion solicitada:
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3">
          <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
            Especificacion
          </label>
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
            placeholder={placeholder}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
          />
          <p className="text-label-sm text-on-surface-variant mt-2">
            Ej: {placeholder}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" onClick={handleCancel} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            className="flex-1"
            disabled={!value.trim()}
          >
            Agregar al carrito
          </Button>
        </div>
      </div>
    </DetailModal>
  );
}

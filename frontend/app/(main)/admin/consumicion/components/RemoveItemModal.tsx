"use client";

import { useState } from "react";
import { AdminCrudModal, FormField, InputField } from "@/components/ui/AdminCrudModal";
import { MaterialIcon, Badge } from "@/components/ui";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import type { UserProductAdmin } from "@/lib/api";

interface RemoveItemModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (quantity: number) => void;
  item: UserProductAdmin | null;
  loading?: boolean;
}

export default function RemoveItemModal({
  open,
  onClose,
  onConfirm,
  item,
  loading,
}: RemoveItemModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");

  if (!item) return null;

  const handleQuantityChange = (value: string) => {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      setQuantity(1);
      setError("");
      return;
    }
    if (num < 1) {
      setError("La cantidad debe ser al menos 1");
    } else if (num > item.quantity) {
      setError(`La cantidad no puede exceder ${item.quantity} (cantidad actual)`);
    } else {
      setError("");
    }
    setQuantity(num);
  };

  const handleConfirm = () => {
    if (error) return;
    onConfirm(quantity);
    setQuantity(1);
    setError("");
  };

  return (
    <AdminCrudModal
      open={open}
      onClose={onClose}
      title="Detalle de consumición"
      size="md"
      saving={loading}
      saveDisabled={!!error}
      onSave={handleConfirm}
      saveLabel="Confirmar retirada"
      cancelLabel="Cancelar"
    >
      <div className="space-y-4">
        {/* Producto */}
        <div className="flex items-start gap-4">
          {item.product.image_url ? (
            <Image
              src={item.product.image_url}
              alt={item.product.name}
              width={72}
              height={72}
              className="w-18 h-18 rounded-xl object-cover shrink-0"
              unoptimized={isStoredUpload(item.product.image_url)}
            />
          ) : (
            <div className="w-18 h-18 rounded-xl bg-surface-container-high flex items-center justify-center shrink-0">
              <MaterialIcon name="inventory_2" className="text-3xl text-on-surface-variant" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="font-display text-title-md text-on-surface">{item.product.name}</h3>
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="tag" color={item.product.shop === "borgin" ? "default" : "primary"}>
                {item.product.shop === "borgin" ? "Borgin & Burkes" : "Flourish & Blotts"}
              </Badge>
              {item.product.category && <Badge variant="tag">{item.product.category}</Badge>}
            </div>
            {item.product.description && (
              <p className="text-body-sm text-on-surface-variant mt-2 line-clamp-3">
                {item.product.description}
              </p>
            )}
          </div>
        </div>

        {/* Especificacion del comprador */}
        {item.specification ? (
          <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
            <p className="text-label-sm text-primary uppercase tracking-wider font-semibold mb-1 flex items-center gap-1">
              <MaterialIcon name="edit_note" className="text-[1.1em]" />
              Especificacion del comprador
            </p>
            <p className="text-body-md text-on-surface">{item.specification}</p>
          </div>
        ) : (
          <div className="rounded-xl bg-surface-container-high px-4 py-3">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider font-semibold mb-1">
              Especificacion del comprador
            </p>
            <p className="text-body-sm text-on-surface-variant">Sin especificacion</p>
          </div>
        )}

        {/* Datos de compra */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Usuario</p>
            <p className="text-body-md text-on-surface font-medium mt-1">{item.user.name}</p>
            <p className="text-label-sm text-on-surface-variant">{item.user.email}</p>
            {item.user.house && (
              <p className="text-label-sm text-on-surface-variant capitalize mt-1">Casa: {item.user.house}</p>
            )}
          </div>
          <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3">
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Precio unit.</p>
            <p className="text-body-md text-on-surface font-medium mt-1 flex items-center gap-1">
              {item.product.price}
              <MaterialIcon name="diamond" filled className="text-sm" inline />
            </p>
            <p className="text-label-sm text-on-surface-variant mt-1">Cantidad: {item.quantity}</p>
          </div>
        </div>

        <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">Fecha de compra</p>
          <p className="text-body-md text-on-surface font-medium mt-1">
            {new Date(item.purchased_at).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>

        <div className="border-t border-outline-variant/20 pt-4">
          <FormField
            label="Cantidad a retirar"
            required
            helpText={`Maximo: ${item.quantity}`}
            error={error}
          >
            <InputField
              type="number"
              value={quantity.toString()}
              onChange={(v) => handleQuantityChange(v)}
              placeholder="1"
              min={1}
              max={item.quantity}
              firstInput
              className="w-full"
            />
          </FormField>
        </div>

        {error && (
          <div className="text-error text-body-sm flex items-center gap-1">
            <MaterialIcon name="error" className="text-sm" />
            {error}
          </div>
        )}

        <div className="text-body-sm text-on-surface-variant bg-surface-container-high p-3 rounded-lg">
          <p className="font-medium mb-1">
            <MaterialIcon name="warning" className="text-[1.1em] align-[-2px] mr-1" />
            Accion irreversible
          </p>
          <p>
            Esta accion reduce permanentemente el inventario del usuario. Usala cuando un
            integrante haya consumido el objeto en el rol. Revisa la especificacion para
            saber que debes entregarle.
          </p>
        </div>
      </div>
    </AdminCrudModal>
  );
}

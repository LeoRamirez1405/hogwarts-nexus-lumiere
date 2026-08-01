"use client";

import { MaterialIcon } from "@/components/ui";
import { Modal } from "@/components/ui";
import { Button } from "@/components/ui";
import type { AdoptModalProps } from "../types";

export const AdoptModal = ({
  creature,
  adopting,
  petName,
  onClose,
  onNameChange,
  onConfirm,
}: AdoptModalProps) => {
  if (!creature) return null;

  return (
    <Modal open onClose={onClose}>
      <div className="p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <MaterialIcon name="pets" className="text-primary text-2xl" filled />
          <h2 className="font-display text-headline-lg text-on-surface">
            Adoptar a {creature.name}
          </h2>
        </div>
        <p className="text-on-surface-variant text-body-md">
          Ponle un nombre a tu nueva companera. Si lo dejas vacio, se quedara con el nombre de la especie.
        </p>
        <div>
          <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
            Nombre personalizado (opcional)
          </label>
          <input
            type="text"
            autoFocus
            maxLength={40}
            value={petName}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder={creature.name}
            className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
          />
          <p className="text-label-sm text-on-surface-variant mt-1">
            Max. 40 caracteres
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button
            variant="primary"
            disabled={adopting === creature.id}
            onClick={() => onConfirm(petName.trim() || undefined)}
            className="flex-1"
          >
            {adopting === creature.id ? "Adoptando..." : "Adoptar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
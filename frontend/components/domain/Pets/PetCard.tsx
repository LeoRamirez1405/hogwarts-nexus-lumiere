"use client";

import { MaterialIcon, Avatar, ProgressBar } from "@/components/ui";
import { UserCreature, UserPetItem, PetType } from "@/lib/api";

const STAGE_LABELS: Record<string, string> = {
  cria: "Cría",
  joven: "Joven",
  adulta: "Adulta",
  anciana: "Anciana",
};

const PET_TYPE_LABELS: Record<PetType, string> = {
  avian: "Aves",
  beast: "Bestias",
  critter: "Criaturas pequeñas",
};

interface PetCardProps {
  uc: UserCreature;
  petType: PetType;
  mood: { icon: string; label: string; color: string };
  isFeedOpen: boolean;
  isPlayOpen: boolean;
  foods: UserPetItem[];
  toys: UserPetItem[];
  onToggleFeed: () => void;
  onTogglePlay: () => void;
  onUse: (uc: UserCreature, item: UserPetItem) => void;
  onListForSale: (ucId: string, price: number) => void;
  onUnlist: (ucId: string) => void;
  onToggleSale: (id: string) => void;
  sellFor: string | null;
  sellPrice: string;
  setSellPrice: (price: string) => void;
  using: string | null;
}

export function PetCard({
  uc,
  petType,
  mood,
  isFeedOpen,
  isPlayOpen,
  foods,
  toys,
  onToggleFeed,
  onTogglePlay,
  onUse,
  onListForSale,
  onUnlist,
  onToggleSale,
  sellFor,
  sellPrice,
  setSellPrice,
  using,
}: PetCardProps) {

  const displayName = uc.pet_name || uc.creature?.name || "Sin nombre";

  return (
    <div className="bg-white border border-outline-variant/30 rounded-3xl p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-4">
        <Avatar
          src={uc.creature?.image_url}
          alt={displayName}
          size="lg"
          borderColor="primary"
          initials={displayName.charAt(0)}
        />
        <div className="flex-1 min-w-0">
          <h4 className="font-display text-title-md text-on-surface truncate">
            {displayName}
          </h4>
          {uc.pet_name && uc.creature?.name && (
            <p className="text-label-sm text-on-surface-variant truncate italic">
              {uc.creature.name}
            </p>
          )}
          <p className="text-label-sm text-primary font-semibold">
            Nv {uc.level} · {uc.level_name}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {STAGE_LABELS[uc.stage] ?? uc.stage} · {uc.age_days}d · {PET_TYPE_LABELS[petType]}
          </p>
        </div>
        <span className={`flex items-center gap-1 text-label-sm font-bold ${mood.color}`} title={mood.label}>
          <MaterialIcon name={mood.icon} className="text-[1.3em]" filled />
        </span>
      </div>

      {uc.stage === "anciana" && (
        <div className="mb-3 text-label-sm text-error bg-error/5 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
          <MaterialIcon name="hourglass_bottom" className="text-[1.1em]" />
          Ya es muy mayor. Disfruta sus ultimos dias.
        </div>
      )}

      {/* Stats */}
      <div className="space-y-3 mb-5">
        <ProgressBar value={uc.hunger} max={100} color={uc.hunger <= 20 ? "error" : "success"} label="Hambre" showValue />
        <ProgressBar value={uc.happiness} max={100} color={uc.happiness <= 20 ? "error" : "primary"} label="Felicidad" showValue />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onToggleFeed}
          className={`flex-1 flex items-center justify-center gap-2 border rounded-xl py-2 text-label-sm font-bold transition-all active:scale-95 ${
            isFeedOpen ? "bg-success text-on-success border-success" : "border-success text-success hover:bg-success hover:text-on-success"
          }`}
        >
          <MaterialIcon name="restaurant" className="text-[1.1em]" />
          Alimentar
        </button>
        <button
          onClick={onTogglePlay}
          className={`flex-1 flex items-center justify-center gap-2 border rounded-xl py-2 text-label-sm font-bold transition-all active:scale-95 ${
            isPlayOpen ? "bg-primary text-on-primary border-primary" : "border-primary text-primary hover:bg-primary hover:text-on-primary"
          }`}
        >
          <MaterialIcon name="sports_esports" className="text-[1.1em]" />
          Jugar
        </button>
      </div>

      {/* Item picker */}
      {(isFeedOpen || isPlayOpen) && (
        <div className="mt-4 border-t border-outline-variant/30 pt-4">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-3">
            {isFeedOpen ? "Elige comida" : "Elige un juguete"} para {PET_TYPE_LABELS[petType].toLowerCase()}
          </p>
          {(isFeedOpen ? foods : toys).length === 0 ? (
            <div className="text-center py-4">
              <p className="text-on-surface-variant text-body-sm mb-2">
                No tienes {isFeedOpen ? "comida" : "juguetes"} para este tipo.
              </p>
              <button
                onClick={() => { }}
                className="text-primary text-label-sm font-bold hover:underline"
              >
                Ir a la Tienda
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {(isFeedOpen ? foods : toys).map((row) => (
                <button
                  key={row.id}
                  onClick={() => onUse(uc, row)}
                  disabled={using === row.id}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
                >
                  <MaterialIcon name={isFeedOpen ? "nutrition" : "toys"} className="text-primary text-[1.3em]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-sm font-medium text-on-surface truncate">{row.pet_item?.name}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      +{row.pet_item?.restore_amount} {isFeedOpen ? "hambre" : "felicidad"} · x{row.quantity}
                    </p>
                  </div>
                  <span className="text-label-sm text-on-surface-variant">{using === row.id ? "..." : "Usar"}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resale controls */}
      <div className="mt-4 border-t border-outline-variant/30 pt-3">
        {uc.for_sale ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-label-sm text-secondary font-medium flex items-center gap-1">
              <MaterialIcon name="sell" className="text-[1.1em]" filled />
              En venta por {uc.sale_price?.toLocaleString()} zerines
            </span>
            <button onClick={() => onUnlist(uc.id)} className="text-label-sm text-error font-bold hover:underline">
              Retirar
            </button>
          </div>
        ) : sellFor === uc.id ? (
          <div className="flex items-center gap-2">
            <input
              type="number"
              autoFocus
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              placeholder="Precio en zerines"
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant/20 text-body-sm outline-none focus:border-primary"
            />
            <button onClick={() => onListForSale(uc.id, parseInt(sellPrice) || 0)} disabled={!(parseInt(sellPrice) > 0)} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-label-sm font-bold disabled:opacity-40">
              Publicar
            </button>
            <button onClick={() => { onToggleSale(uc.id); setSellPrice(""); }} className="text-label-sm text-on-surface-variant">
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => onToggleSale(uc.id)}
            className="w-full flex items-center justify-center gap-2 text-label-sm text-on-surface-variant hover:text-secondary transition-colors py-1"
          >
            <MaterialIcon name="sell" className="text-[1.1em]" />
            Poner en venta
          </button>
        )}
      </div>
    </div>
  );
}
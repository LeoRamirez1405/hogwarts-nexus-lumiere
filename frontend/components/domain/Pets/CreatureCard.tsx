"use client";

import Image from "next/image";
import { MaterialIcon, ZerineDisplay, Button } from "@/components/ui";
import { Creature, SanctuaryStats } from "@/lib/api";

const RARITY_LABELS: Record<string, string> = {
  common: "Comun",
  uncommon: "Poco Comun",
  rare: "Raro",
  legendary: "Legendario",
  ethereal: "Etereo",
};

const RARITY_COLORS: Record<string, string> = {
  rare: "text-primary",
  uncommon: "text-secondary",
  ethereal: "text-tertiary",
  legendary: "text-secondary",
  common: "text-outline",
};

const RARITY_BG: Record<string, string> = {
  rare: "bg-primary/5",
  uncommon: "bg-secondary/5",
  ethereal: "bg-tertiary/5",
  legendary: "bg-secondary/10",
  common: "bg-surface-container-high/50",
};

const PET_TYPE_LABELS: Record<string, string> = {
  avian: "Aves",
  beast: "Bestias",
  critter: "Criaturas pequeñas",
};

interface CreatureCardProps {
  creature: Creature;
  isAdopted: boolean;
  meetsRequirements: boolean;
  stats: SanctuaryStats | null;
  onAdopt: () => void;
  adopting: boolean;
}

export function CreatureCard({
  creature,
  isAdopted,
  meetsRequirements,
  stats,
  onAdopt,
  adopting,
}: CreatureCardProps) {
  const reqUser = creature.required_user_level || 1;
  const reqSanct = creature.required_sanctuary_level || 0;

  return (
    <div className={`glass-card rounded-3xl p-6 group transition-all duration-300 ${meetsRequirements ? "hover:-translate-y-2" : "opacity-80"} ${RARITY_BG[creature.rarity] || ""}`}>
      <div className="relative h-56 rounded-2xl overflow-hidden mb-4">
        <Image
          src={creature.image_url || "/placeholder-creature.jpg"}
          alt={creature.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <span className={`absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-bold shadow-sm ${RARITY_COLORS[creature.rarity] || "text-outline"}`}>
          {RARITY_LABELS[creature.rarity] || creature.rarity}
        </span>
        <span className="absolute top-4 left-4 bg-on-surface/70 text-white backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-medium">
          {PET_TYPE_LABELS[creature.pet_type] || creature.pet_type}
        </span>
      </div>
      <h3 className="font-display text-title-md text-primary mb-1">
        {creature.name}
      </h3>
      <p className="text-on-surface-variant text-body-md line-clamp-2 mb-3">
        {creature.description}
      </p>
      {(reqUser > 1 || reqSanct > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reqUser > 1 && (
            <span className={`text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stats && stats.user_level >= reqUser ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
              <MaterialIcon name="military_tech" className="text-[1em]" filled />
              Magico Nv {reqUser}
            </span>
          )}
          {reqSanct > 0 && (
            <span className={`text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stats && stats.sanctuary_level >= reqSanct ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
              <MaterialIcon name="castle" className="text-[1em]" filled />
              Santuario Nv {reqSanct}
            </span>
          )}
        </div>
      )}
      <div className="flex items-center justify-between">
        <ZerineDisplay amount={creature.price} iconStyle="icon" variant="price" />
        {isAdopted ? (
          <span className="text-label-sm text-success font-bold flex items-center gap-1">
            <MaterialIcon name="check_circle" className="text-[1em]" filled />
            Adoptada
          </span>
        ) : (
          <Button
            onClick={onAdopt}
            disabled={adopting || !meetsRequirements}
            title={meetsRequirements ? "" : "No cumples el nivel requerido"}
          >
            {adopting ? "Adoptando..." : meetsRequirements ? "Adoptar" : "Bloqueada"}
          </Button>
        )}
      </div>
    </div>
  );
}
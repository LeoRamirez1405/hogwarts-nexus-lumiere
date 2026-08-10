"use client";

import { useState } from "react";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { MaterialIcon, ZerineDisplay, Button } from "@/components/ui";
import { Creature, SanctuaryStats } from "@/lib/api";
import { getFallbackForCreature } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { useFeatureFlag } from "@/lib/featureFlagStore";

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

interface CreatureCardProps {
  creature: Creature;
  isAdopted: boolean;
  meetsRequirements: boolean;
  stats: SanctuaryStats | null;
  onAdopt: () => void;
  adopting: boolean;
  userZerines: number;
  onViewDetails?: (creature: Creature) => void;
}

export function CreatureCard({
  creature,
  isAdopted,
  meetsRequirements,
  stats,
  onAdopt,
  adopting,
  userZerines,
  onViewDetails,
}: CreatureCardProps) {
  const theme = useTheme();
  const hideRequirements = useFeatureFlag("pets.hide_creature_requirements");
  const [imageError, setImageError] = useState(false);
  const reqUser = creature.required_user_level || 1;
  const reqSanct = creature.required_sanctuary_level || 0;
  const insufficientZerines = userZerines < creature.price;

  const fallbackSrc = getFallbackForCreature(theme);

  return (
    <div
      className={`glass-card rounded-3xl p-6 group transition-all duration-300 ${meetsRequirements ? "hover:-translate-y-2" : "opacity-80"} ${RARITY_BG[creature.rarity] || ""}`}
      onClick={() => onViewDetails?.(creature)}
    >
      <div className="relative h-56 rounded-2xl overflow-hidden mb-4">
        <Image
          src={creature.image_url || fallbackSrc}
          alt={creature.name}
          fill
          className="object-cover group-hover:scale-110 transition-transform duration-500"
          unoptimized={isStoredUpload(creature.image_url)}
          onError={() => !imageError && setImageError(true)}
        />
        {!hideRequirements && (
          <span className={`absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-bold shadow-sm ${RARITY_COLORS[creature.rarity] || "text-outline"}`}>
            {RARITY_LABELS[creature.rarity] || creature.rarity}
          </span>
        )}
        <span className="absolute top-4 left-4 bg-on-surface/70 text-white backdrop-blur-md px-3 py-1 rounded-full text-label-sm font-medium">
          {creature.pet_type}
        </span>
      </div>
      <h3 className="font-display text-title-md text-primary mb-1">
        {creature.name}
      </h3>
      <p className="text-on-surface-variant text-body-md line-clamp-2 mb-3">
        {creature.description}
      </p>
      {creature.ability && (
        <div className="flex items-start gap-2 mb-3 bg-secondary/5 border border-secondary/10 rounded-xl px-3 py-2">
          <MaterialIcon name="auto_awesome" className="text-secondary text-[1.1em] mt-0.5" filled />
          <p className="text-label-sm text-on-surface-variant leading-snug">{creature.ability}</p>
        </div>
      )}
      {!hideRequirements && (reqUser > 1 || reqSanct > 0) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {reqUser > 1 && (
            <span className={`text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stats && stats.user_level >= reqUser ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
              <MaterialIcon name="military_tech" className="text-[1em]" filled />
              Mágico Nv {reqUser}
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
            onClick={(e) => {
              e.stopPropagation();
              onAdopt();
            }}
            disabled={adopting || !meetsRequirements || insufficientZerines}
            title={
              !meetsRequirements
                ? "No cumples el nivel requerido"
                : insufficientZerines
                ? "No tienes suficientes Zerines"
                : ""
            }
          >
            {adopting ? "Adoptando..." : meetsRequirements ? "Adoptar" : "Bloqueada"}
          </Button>
        )}
      </div>
    </div>
  );
}
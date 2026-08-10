"use client";

import { memo } from "react";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { Creature, MarketCreature, SanctuaryStats } from "@/lib/api";
import { getFallbackForCreature } from "@/lib/fallbacks";
import { MaterialIcon, ZerineDisplay, Button, Badge } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";
import { useFeatureFlag } from "@/lib/featureFlagStore";

const RARITY_LABELS: Record<string, string> = {
  common: "Común",
  uncommon: "Poco Común",
  rare: "Raro",
  legendary: "Legendario",
  ethereal: "Etéreo",
};

const RARITY_COLORS: Record<string, string> = {
  rare: "text-primary",
  uncommon: "text-secondary",
  ethereal: "text-tertiary",
  legendary: "text-secondary",
  common: "text-outline",
};

interface CreatureDetailContentProps {
  creature: Creature;
  market?: MarketCreature | null;
  stats?: SanctuaryStats | null;
  meetsRequirements?: boolean;
  onAdopt?: () => void;
  onBuy?: () => void;
  adopting?: boolean;
  buying?: boolean;
  userZerines?: number;
}

export const CreatureDetailContent = memo(function CreatureDetailContent({
  creature,
  market,
  stats,
  meetsRequirements = true,
  onAdopt,
  onBuy,
  adopting,
  buying,
  userZerines = 0,
}: CreatureDetailContentProps) {
  const theme = useTheme();
  const hideRequirements = useFeatureFlag("pets.hide_creature_requirements");
  const isMarket = !!market;
  const fallbackSrc = getFallbackForCreature(theme);
  const price = isMarket ? market!.sale_price : creature.price;
  const insufficientZerines = userZerines < price;
  const reqUser = creature.required_user_level || 1;
  const reqSanct = creature.required_sanctuary_level || 0;

  return (
    <div className="space-y-5">
      <div className="relative h-56 rounded-2xl overflow-hidden">
        <Image
          src={creature.image_url || fallbackSrc}
          alt={creature.name}
          fill
          className="object-cover"
          unoptimized={isStoredUpload(creature.image_url)}
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

      <div className="space-y-3">
        <h2 className="font-display text-headline-md text-primary">{creature.name}</h2>

        <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
          {creature.description}
        </div>

        {creature.ability && (
          <div className="flex items-start gap-2 p-3 bg-secondary/5 border border-secondary/10 rounded-xl">
            <MaterialIcon name="auto_awesome" className="text-secondary text-[1.1em] mt-0.5" filled />
            <p className="text-label-sm text-on-surface-variant leading-snug">{creature.ability}</p>
          </div>
        )}

        {!hideRequirements && (reqUser > 1 || reqSanct > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {reqUser > 1 && (
              <span className={`text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stats && stats.user_level >= reqUser ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                <MaterialIcon name="military_tech" className="text-[1em]" filled />
                Nivel Mágico {reqUser}
              </span>
            )}
            {reqSanct > 0 && (
              <span className={`text-label-sm px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${stats && stats.sanctuary_level >= reqSanct ? "bg-success/10 text-success" : "bg-error/10 text-error"}`}>
                <MaterialIcon name="castle" className="text-[1em]" filled />
                Nivel Santuario {reqSanct}
              </span>
            )}
          </div>
        )}

        {isMarket && market && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/30">
            <Badge variant="tag" color="secondary">
              Vende: {market.seller_name}
            </Badge>
            {market.pet_name && market.creature?.name && (
              <Badge variant="tag" color="default">
                Nombre: {market.pet_name}
              </Badge>
            )}
            <Badge variant="tag" color="default">
              Nv {market.level} · {market.level_name}
            </Badge>
            <Badge variant="tag" color="default">
              {market.stage}
            </Badge>
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
          <ZerineDisplay amount={price} iconStyle="icon" variant="price" />
          {isMarket ? (
            <Button
              onClick={onBuy}
              disabled={buying || !meetsRequirements || insufficientZerines}
              title={
                !meetsRequirements
                  ? "No cumples el nivel requerido"
                  : insufficientZerines
                  ? "No tienes suficientes Zerines"
                  : ""
              }
              variant="secondary"
            >
              {buying ? "Comprando..." : meetsRequirements ? "Comprar" : "Bloqueada"}
            </Button>
          ) : onAdopt ? (
            <Button
              onClick={onAdopt}
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
          ) : null}
        </div>
      </div>
    </div>
  );
});
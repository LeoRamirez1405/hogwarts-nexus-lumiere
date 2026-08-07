"use client";

import { memo } from "react";
import Image from "next/image";
import { UserCreature } from "@/lib/api";
import { getFallbackForCreature } from "@/lib/fallbacks";
import { MaterialIcon, ProgressBar, Button } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";

const STAGE_LABELS: Record<string, string> = {
  cria: "Cría",
  joven: "Joven",
  adulta: "Adulta",
  anciana: "Anciana",
};

const MOOD_COLORS: Record<string, string> = {
  critico: "text-error",
  hambriento: "text-warning",
  triste: "text-warning",
  feliz: "text-success",
  bien: "text-primary",
};

const MOOD_ICONS: Record<string, string> = {
  critico: "warning",
  hambriento: "restaurant",
  triste: "sentiment_dissatisfied",
  feliz: "pets",
  bien: "sentiment_satisfied",
};

interface MyPetDetailContentProps {
  userCreature: UserCreature;
  petType: string;
  onFeed?: () => void;
  onPlay?: () => void;
  onGoToShop?: () => void;
}

export const MyPetDetailContent = memo(function MyPetDetailContent({
  userCreature,
  petType,
  onFeed,
  onPlay,
  onGoToShop,
}: MyPetDetailContentProps) {
  const theme = useTheme();
  const displayName = userCreature.pet_name || userCreature.creature?.name || "Sin nombre";
  const speciesName = userCreature.creature?.name || "Desconocida";
  const speciesDescription = userCreature.creature?.description || "Sin descripción disponible.";
  const fallbackSrc = getFallbackForCreature(theme);
  const imageSrc = userCreature.creature?.image_url || fallbackSrc;

  const moodKey = userCreature.mood.toLowerCase() as keyof typeof MOOD_COLORS;
  const moodColor = MOOD_COLORS[moodKey] || "text-on-surface";
  const moodIcon = MOOD_ICONS[moodKey] || "pets";

  return (
    <div className="space-y-5">
      <div className="relative h-56 rounded-2xl overflow-hidden">
        <Image
          src={imageSrc}
          alt={displayName}
          fill
          className="object-cover"
          unoptimized={userCreature.creature?.image_url?.startsWith("http://localhost:8000/uploads/") || userCreature.creature?.image_url?.startsWith("/fallbacks/")}
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
            <Image
              src={imageSrc}
              alt={displayName}
              fill
              className="object-cover"
              unoptimized={userCreature.creature?.image_url?.startsWith("http://localhost:8000/uploads/") || userCreature.creature?.image_url?.startsWith("/fallbacks/")}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-headline-md text-on-surface truncate">{displayName}</h2>
            {userCreature.pet_name && (
              <p className="text-label-sm text-on-surface-variant truncate italic">Especie: {speciesName}</p>
            )}
            <p className="text-label-sm text-primary font-semibold mt-1">
              Nv {userCreature.level} · {userCreature.level_name}
            </p>
            <p className="text-label-sm text-on-surface-variant">
              {STAGE_LABELS[userCreature.stage] ?? userCreature.stage} · {userCreature.age_days}d · {petType}
            </p>
            <span className={`inline-flex items-center gap-1 text-label-sm font-bold mt-2 ${moodColor}`} title={userCreature.mood}>
              <MaterialIcon name={moodIcon} className="text-[1.3em]" filled />
              {userCreature.mood}
            </span>
          </div>
        </div>

        {userCreature.stage === "anciana" && (
          <div className="text-label-sm text-error bg-error/5 rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <MaterialIcon name="hourglass_bottom" className="text-[1.1em]" />
            Ya es muy mayor. Disfruta sus últimos días.
          </div>
        )}

        <div className="space-y-3 pt-2 border-t border-outline-variant/30">
          <h3 className="font-display text-title-md text-on-surface">Estado</h3>
          <ProgressBar value={userCreature.hunger} max={100} color={userCreature.hunger <= 20 ? "error" : "success"} label="Hambre" showValue />
          <ProgressBar value={userCreature.happiness} max={100} color={userCreature.happiness <= 20 ? "error" : "primary"} label="Felicidad" showValue />
        </div>

        {onFeed || onPlay ? (
          <div className="flex gap-3 pt-2 border-t border-outline-variant/30">
            {onFeed && (
              <Button
                onClick={onFeed}
                className="flex-1 flex items-center justify-center gap-2 border border-success text-success hover:bg-success hover:text-on-success"
              >
                <MaterialIcon name="restaurant" className="text-[1.1em]" />
                Alimentar
              </Button>
            )}
            {onPlay && (
              <Button
                onClick={onPlay}
                className="flex-1 flex items-center justify-center gap-2 border border-primary text-primary hover:bg-primary hover:text-on-primary"
              >
                <MaterialIcon name="sports_esports" className="text-[1.1em]" />
                Jugar
              </Button>
            )}
          </div>
        ) : onGoToShop ? (
          <div className="pt-2 border-t border-outline-variant/30">
            <Button
              onClick={onGoToShop}
              variant="secondary"
              className="w-full"
            >
              <MaterialIcon name="store" className="text-[1.1em]" />
              Ir a la Tienda
            </Button>
          </div>
        ) : null}

        <div className="pt-2 border-t border-outline-variant/30">
          <h3 className="font-display text-title-md text-on-surface mb-2">Sobre la especie</h3>
          <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
            {speciesDescription}
          </div>
        </div>

        {userCreature.creature?.ability && (
          <div className="pt-2 border-t border-outline-variant/30">
            <h3 className="font-display text-title-md text-on-surface mb-2">Habilidad especial</h3>
            <div className="flex items-start gap-2 p-3 bg-secondary/5 border border-secondary/10 rounded-xl">
              <MaterialIcon name="auto_awesome" className="text-secondary text-[1.1em] mt-0.5" filled />
              <p className="text-label-sm text-on-surface-variant leading-snug">{userCreature.creature.ability}</p>
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-outline-variant/30">
          <h3 className="font-display text-title-md text-on-surface mb-2">Detalles</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-on-surface-variant">Adoptado el</p>
              <p className="font-semibold text-on-surface">
                {new Date(userCreature.adopted_at).toLocaleDateString("es-ES", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-on-surface-variant">ID</p>
              <p className="font-mono text-xs text-on-surface-variant truncate">{userCreature.id}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
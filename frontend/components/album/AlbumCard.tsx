"use client";

import Image from "next/image";
import { motion } from "motion/react";
import { MaterialIcon } from "@/components/ui";
import type { AlbumCard as AlbumCardType, CollectionCard } from "@/lib/api";

export const RARITY_LABEL: Record<string, string> = {
  common: "Común",
  rare: "Rara",
  ultra_rare: "Ultra Rara",
  special: "Especial",
  legendary: "Legendaria",
};

interface AlbumCardProps {
  card: AlbumCardType;
  owned?: CollectionCard;
  fresh?: boolean;
  layoutId?: string;
  compact?: boolean;
}

export function AlbumCard({ card, owned, fresh, layoutId, compact }: AlbumCardProps) {
  const body = (
    <div
      data-rarity={owned ? card.rarity : undefined}
      className={`album-card w-full ${
        compact ? "aspect-[5/7]" : "aspect-square"
      } ${owned ? "" : "album-slot-empty"} ${owned?.foil ? "album-card-foil" : ""}`}
      title={`#${card.slot_number}${owned ? ` — ${RARITY_LABEL[card.rarity] ?? card.rarity}` : ""}`}
    >
      {owned ? (
        <div className="relative h-full w-full">
          <Image
            src={owned.image_url || "/fallbacks/generic/image-placeholder-light.svg"}
            alt={owned.title || `Figurita #${card.slot_number}`}
            fill
            sizes="(max-width: 768px) 18vw, 120px"
            className="object-cover"
            loading="lazy"
            decoding="async"
          />
          {owned.quantity > 1 && (
            <span className="absolute top-0.5 right-0.5 rounded-full bg-primary text-surface px-1.5 text-[10px] font-bold leading-4">
              ×{owned.quantity}
            </span>
          )}
          {owned.foil && (
            <span className="absolute top-0.5 left-0.5 rounded-sm bg-[#c9a227] px-1 text-[8px] font-bold leading-3.5 text-surface shadow">
              FOIL
            </span>
          )}
          {fresh && (
            <motion.span
              initial={{ scale: 0, rotate: -30 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 12 }}
              className="absolute bottom-0.5 left-0.5 rounded-full bg-secondary text-surface px-1.5 text-[9px] font-bold leading-4 shadow"
            >
              ¡NUEVA!
            </motion.span>
          )}
        </div>
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 text-outline">
          <MaterialIcon name="help" className="text-base sm:text-xl" />
          <span className="text-[9px] font-mono sm:text-xs">{card.slot_number}</span>
        </div>
      )}
    </div>
  );

  if (!layoutId) return body;
  return (
    <motion.div layoutId={layoutId} transition={{ type: "spring", stiffness: 200, damping: 20 }}>
      {body}
    </motion.div>
  );
}
"use client";

import { AnimatePresence, motion } from "motion/react";
import { AlbumCard } from "./AlbumCard";
import type { AlbumCard as AlbumCardType, CollectionCard } from "@/lib/api";

interface AlbumGridProps {
  cards: AlbumCardType[];
  ownedByCardId: Record<string, CollectionCard>;
  freshCardIds?: string[];
  layoutIdPrefix?: string;
  compact?: boolean;
}

export function AlbumGrid({
  cards,
  ownedByCardId,
  freshCardIds = [],
  layoutIdPrefix,
  compact,
}: AlbumGridProps) {
  const sorted = [...cards].sort((a, b) => a.slot_number - b.slot_number);

  return (
    <div className={`grid w-full grid-cols-5 ${compact ? "gap-1" : "gap-1.5 sm:gap-2"}`}>
      {sorted.map((card) => {
        const owned = ownedByCardId[card.id];
        const fresh = freshCardIds.includes(card.id);
        const layoutId = layoutIdPrefix && owned ? `${layoutIdPrefix}-${card.id}` : undefined;
        return (
          <AnimatePresence key={card.id} initial={false}>
            <motion.div
              key={card.id}
              initial={fresh ? { scale: 0.6, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative"
            >
              <AlbumCard
                card={card}
                owned={owned}
                fresh={fresh}
                layoutId={layoutId}
                compact={compact}
              />
              {fresh && (
                <motion.span
                  layoutId={layoutId ? `${layoutId}-ring` : undefined}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.25, type: "spring", stiffness: 200, damping: 15 }}
                  className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-secondary"
                />
              )}
            </motion.div>
          </AnimatePresence>
        );
      })}
    </div>
  );
}
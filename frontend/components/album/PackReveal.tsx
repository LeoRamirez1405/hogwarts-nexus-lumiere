"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { AlbumCard } from "./AlbumCard";
import { AlbumGrid } from "./AlbumGrid";
import { Button } from "@/components/ui";
import type { AlbumCard as AlbumCardType, CollectionCard, OpenPackResult } from "@/lib/api";

const RARITY_RANK: Record<string, number> = {
  common: 0,
  rare: 1,
  ultra_rare: 2,
  special: 3,
  legendary: 4,
};

const RARITY_BADGE: Record<string, string> = {
  common: "bg-outline-variant text-on-surface-variant",
  rare: "bg-[#4a7fb5] text-surface",
  ultra_rare: "bg-[#c9a227] text-surface",
  special: "bg-[#8a63c9] text-surface",
  legendary: "bg-[#f0c33c] text-surface",
};

type Phase = "shake" | "reveal" | "adhere" | "done";

interface PackRevealProps {
  result: OpenPackResult;
  albumCards: AlbumCardType[];
  ownedByCardId: Record<string, CollectionCard>;
  onAdhere: () => Promise<void>;
  onClose: () => void;
  onViewAlbum: () => void;
}

const FLIP_STEP_MS = 1000;

export function PackReveal({
  result,
  albumCards,
  ownedByCardId,
  onAdhere,
  onClose,
  onViewAlbum,
}: PackRevealProps) {
  const [phase, setPhase] = useState<Phase>("shake");
  const [revealedCount, setRevealedCount] = useState(0);
  const [adhering, setAdhering] = useState(false);

  const ordered = useMemo(
    () => [...result.cards].sort((a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]),
    [result.cards]
  );

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), 1300);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "reveal") return;
    if (revealedCount >= ordered.length) {
      const timer = setTimeout(() => setPhase("adhere"), 900);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      setRevealedCount((n) => n + 1);
      const card = ordered[revealedCount];
      if (card) {
        navigator.vibrate?.(card.rarity === "legendary" ? [40, 60, 120] : 25);
      }
    }, revealedCount === 0 ? 400 : FLIP_STEP_MS);
    return () => clearTimeout(timer);
  }, [phase, revealedCount, ordered]);

  useEffect(() => {
    if (phase !== "done") return;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.3 } });
  }, [phase]);

  const handleAdhere = async () => {
    if (adhering) return;
    setAdhering(true);
    await onAdhere();
    setPhase("done");
    setAdhering(false);
  };

  const showFan = phase === "reveal" || phase === "adhere";
  const showGrid = phase === "adhere" || phase === "done";
  const newCount = result.cards.filter((c) => c.is_new).length;
  const dupeCount = result.cards.length - newCount;

  return (
    <div className="fixed inset-0 top-[var(--topbar-h)] z-[60] flex flex-col items-center overflow-y-auto bg-surface/95 backdrop-blur-sm">
      <div className="flex w-full max-w-lg flex-1 flex-col items-center px-4 py-6">
        {/* Cabecera: botón glass + nombre del sobre */}
        <div className="mb-3 flex w-full items-center justify-between">
          <button
            className="glass-card inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95"
            onClick={onClose}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-lg text-primary">close</span>
          </button>
          <span className="font-body text-sm font-medium text-on-surface-variant">
            {result.pack_type_name}
          </span>
          <span className="w-10" />
        </div>

        {/* Sobre cerrado: sacudida + estallido */}
        <AnimatePresence>
          {phase === "shake" && (
            <motion.div
              key="pack"
              exit={{ scale: 3, opacity: 0, transition: { duration: 0.45 } }}
              animate={{ rotate: [0, -6, 6, -6, 6, 0], scale: [1, 1.06, 1] }}
              transition={{ duration: 0.75, ease: "easeInOut" }}
              className="pack-back mt-10 flex h-44 w-32 items-center justify-center rounded-xl shadow-2xl"
            >
              <span className="material-symbols-outlined text-5xl text-secondary-fixed">
                markunread_mailbox
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cartas: flip 3D en cascada, la mas rara al final */}
        <AnimatePresence>
          {showFan && (
            <motion.div
              key="fan"
              exit={{ opacity: 0, transition: { duration: 0.35 } }}
              className="mt-6 flex min-h-[250px] w-full flex-wrap items-end justify-center gap-2 sm:gap-3"
            >
              {ordered.map((card, i) => {
                const revealed = i < revealedCount;
                const isLatest = revealed && i === revealedCount - 1;
                return (
                  <motion.div
                    key={`${card.card_id}-${i}`}
                    layoutId={`reveal-${card.card_id}`}
                    className="w-[26%] max-w-[150px]"
                    style={{ perspective: 900 }}
                    animate={
                      revealed
                        ? { y: isLatest ? -10 : 0, opacity: 1, scale: isLatest ? 1.06 : 1 }
                        : { y: 30, opacity: 0, scale: 0.9 }
                    }
                    transition={{ type: "spring", stiffness: 200, damping: 18 }}
                  >
                    <div className="relative aspect-[5/7] w-full" style={{ transformStyle: "preserve-3d" }}>
                      <motion.div
                        className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden" }}
                        initial={false}
                        animate={revealed ? { rotateY: 0 } : { rotateY: 180 }}
                        transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}
                      >
                        <AlbumCard
                          card={
                            albumCards.find((c) => c.id === card.card_id) ?? {
                              id: card.card_id,
                              album_id: result.pack_id,
                              slot_number: card.slot_number,
                              title: card.title,
                              image_url: card.image_url,
                              rarity: card.rarity,
                              created_at: "",
                            }
                          }
                          owned={
                            ownedByCardId[card.card_id] ?? {
                              card_id: card.card_id,
                              slot_number: card.slot_number,
                              title: card.title,
                              image_url: card.image_url,
                              rarity: card.rarity,
                              quantity: 1,
                            }
                          }
                          compact
                        />
                      </motion.div>
                      <motion.div
                        className="pack-back absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                      >
                        <span className="material-symbols-outlined text-3xl text-secondary-fixed">
                          auto_awesome
                        </span>
                      </motion.div>
                    </div>
                    <AnimatePresence>
                      {revealed && (
                        <motion.span
                          initial={{ scale: 0, rotate: -12 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.5, type: "spring", stiffness: 380, damping: 12 }}
                          className={`mx-auto mt-1 block w-fit rounded-full px-2 py-0.5 text-[10px] font-semibold shadow ${
                            card.foil
                              ? "bg-[#c9a227] text-surface"
                              : RARITY_BADGE[card.rarity] ?? RARITY_BADGE.common
                          }`}
                        >
                          {card.foil ? "¡FOIL DORADA!" : card.is_new ? "¡NUEVA!" : "REPETIDA"}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {ordered.length === 0 && (
          <p className="mt-6 font-body text-sm text-on-surface-variant">
            Este sobre está vacío.
          </p>
        )}

        {/* Adhesion: la grilla aparece y las cartas vuelan a su casilla */}
        <AnimatePresence>
          {showGrid && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 w-full"
            >
              <p className="mb-2 text-center font-body text-sm font-medium text-on-surface-variant">
                {phase === "done" ? "Tus cartas pegadas" : "Adherir las cartas a su casilla"}
              </p>
              <AlbumGrid
                cards={albumCards}
                ownedByCardId={ownedByCardId}
                layoutIdPrefix="reveal"
                compact
              />
              {phase === "adhere" && (
                <Button
                  className="mt-5 w-full"
                  disabled={adhering}
                  onClick={handleAdhere}
                >
                  <span className="material-symbols-outlined mr-2 text-lg">auto_fix_high</span>
                  {adhering ? "Pegando..." : "Adherir al álbum"}
                </Button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Final */}
        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 flex w-full flex-col items-center"
            >
              <p className="text-center font-display text-xl text-primary">
                ¡Tus cartas ya están pegadas!
              </p>
              <p className="mt-1 text-center font-body text-sm text-on-surface-variant">
                {newCount} nuevas · {dupeCount} repetidas
                {result.pity_target > 0 &&
                  ` · piedad: ${result.pity_progress}/${result.pity_target}`}
              </p>
              <div className="mt-4 flex w-full gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={onClose}
                >
                  Seguir abriendo
                </Button>
                <Button
                  className="flex-1"
                  onClick={onViewAlbum}
                >
                  Ver mi álbum
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import confetti from "canvas-confetti";
import { AlbumCard } from "./AlbumCard";
import { Button } from "@/components/ui";
import type { AlbumCard as AlbumCardType, OpenPackResult } from "@/lib/api";

const RARITY_RANK: Record<string, number> = {
  common: 0,
  rare: 1,
  ultra_rare: 2,
  special: 3,
  legendary: 4,
};

type Phase = "shake" | "reveal" | "adhere" | "done";

interface BatchPackRevealProps {
  results: OpenPackResult[];
  albumCards: AlbumCardType[];
  onAdhere: () => Promise<void>;
  onClose: () => void;
  onViewAlbum: () => void;
}

const SHAKE_MS = 1300;
const PACK_GAP_MS = 600;
const FLIP_STEP_MS = 500;
const FIRST_FLIP_DELAY = 400;

interface FlatCard {
  card: OpenPackResult["cards"][number];
  packIndex: number;
}

export function BatchPackReveal({
  results,
  albumCards,
  onAdhere,
  onClose,
  onViewAlbum,
}: BatchPackRevealProps) {
  const [phase, setPhase] = useState<Phase>("shake");
  const [currentPack, setCurrentPack] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [revealCounts, setRevealCounts] = useState<Record<string, number>>({});
  const [lastReveal, setLastReveal] = useState<{ cardId: string; count: number; foil: boolean } | null>(null);
  const [adhering, setAdhering] = useState(false);
  const skipRef = useRef(false);

  const packsOrdered = useMemo(
    () =>
      results.map((result) => ({
        result,
        cards: [...result.cards].sort(
          (a, b) => RARITY_RANK[a.rarity] - RARITY_RANK[b.rarity]
        ),
      })),
    [results]
  );

  const flatSequence = useMemo<FlatCard[]>(
    () =>
      packsOrdered.flatMap((pack, packIndex) =>
        pack.cards.map((card) => ({ card, packIndex }))
      ),
    [packsOrdered]
  );

  const sortedSlots = useMemo(
    () => [...albumCards].sort((a, b) => a.slot_number - b.slot_number),
    [albumCards]
  );

  const rebuildCounts = (sequence: FlatCard[]) => {
    const counts: Record<string, number> = {};
    for (const item of sequence) {
      counts[item.card.card_id] = (counts[item.card.card_id] ?? 0) + 1;
    }
    return counts;
  };

  useEffect(() => {
    const timer = setTimeout(() => setPhase("reveal"), skipRef.current ? 0 : SHAKE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (phase !== "reveal") return;

    if (skipRef.current) {
      const counts = rebuildCounts(flatSequence);
      setRevealCounts(counts);
      setLastReveal(null);
      const t = setTimeout(() => setPhase("adhere"), 0);
      return () => clearTimeout(t);
    }

    if (currentPack >= packsOrdered.length) {
      const t = setTimeout(() => setPhase("adhere"), 0);
      return () => clearTimeout(t);
    }

    const pack = packsOrdered[currentPack];

    if (revealedCount >= pack.cards.length) {
      const t = setTimeout(() => {
        if (currentPack + 1 < packsOrdered.length) {
          setCurrentPack((p) => p + 1);
          setRevealedCount(0);
        }
      }, PACK_GAP_MS);
      return () => clearTimeout(t);
    }

    const delay =
      revealedCount === 0 && currentPack === 0 ? FIRST_FLIP_DELAY : FLIP_STEP_MS;
    const t = setTimeout(() => {
      const card = pack.cards[revealedCount];
      if (card) {
        setRevealCounts((prev) => {
          const next = (prev[card.card_id] ?? 0) + 1;
          setLastReveal({ cardId: card.card_id, count: next, foil: Boolean(card.foil) });
          return { ...prev, [card.card_id]: next };
        });
        navigator.vibrate?.(card.rarity === "legendary" ? [40, 60, 120] : 25);
      }
      setRevealedCount((n) => n + 1);
    }, delay);
    return () => clearTimeout(t);
  }, [phase, currentPack, revealedCount, packsOrdered, flatSequence]);

  useEffect(() => {
    if (phase !== "done") return;
    confetti({ particleCount: 140, spread: 90, origin: { y: 0.3 } });
  }, [phase]);

  const skip = () => {
    skipRef.current = true;
  };

  const handleAdhere = async () => {
    if (adhering) return;
    setAdhering(true);
    await onAdhere();
    setPhase("done");
    setAdhering(false);
  };

  const allRevealed = phase === "adhere" || phase === "done";
  const newCount = flatSequence.filter((c) => c.card.is_new).length;
  const dupeCount = flatSequence.length - newCount;
  const foilCount = flatSequence.filter((c) => c.card.foil).length;
  const totalUnique = Object.keys(
    allRevealed ? rebuildCounts(flatSequence) : revealCounts
  ).length;
  const currentName =
    currentPack < packsOrdered.length
      ? packsOrdered[currentPack].result.pack_type_name
      : "";

  return (
    <div
      className="fixed inset-0 top-[var(--topbar-h)] z-[60] flex flex-col items-center overflow-y-auto bg-surface/95 backdrop-blur-sm"
      onClick={skip}
    >
      <div className="flex w-full max-w-lg flex-1 flex-col items-center px-4 py-6">
        <div className="mb-3 flex w-full items-center justify-between">
          <button
            className="glass-card inline-flex h-10 w-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            aria-label="Cerrar"
          >
            <span className="material-symbols-outlined text-lg text-primary">close</span>
          </button>
          <span className="font-body text-sm font-medium text-on-surface-variant">
            {results.length > 1
              ? `Sobre ${Math.min(currentPack + 1, packsOrdered.length)}/${packsOrdered.length}`
              : currentName || results[0]?.pack_type_name}
          </span>
          <span className="w-10" />
        </div>

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

        {(phase === "reveal" || phase === "adhere") && (
          <div className="mt-4 w-full">
            <div className="grid w-full grid-cols-5 gap-1">
              {sortedSlots.map((albumCard) => {
                const count = revealCounts[albumCard.id] ?? 0;
                const revealed = count > 0;
                const isLast = lastReveal?.cardId === albumCard.id;
                const lastCount = isLast ? lastReveal!.count : 0;
                return (
                  <motion.div
                    key={albumCard.id}
                    className="relative"
                    style={{ perspective: 900 }}
                    initial={false}
                    animate={
                      revealed && isLast
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 0.35, ease: "easeOut" }}
                  >
                    <div
                      className="relative aspect-[5/7] w-full"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <motion.div
                        className="absolute inset-0"
                        style={{ backfaceVisibility: "hidden" }}
                        initial={false}
                        animate={{ rotateY: revealed ? 0 : 180 }}
                        transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}
                      >
                        <AlbumCard
                          card={albumCard}
                          owned={
                            revealed
                              ? {
                                  card_id: albumCard.id,
                                  slot_number: albumCard.slot_number,
                                  title: albumCard.title,
                                  image_url: albumCard.image_url,
                                  rarity: albumCard.rarity,
                                  quantity: count,
                                  foil: isLast ? lastReveal!.foil : false,
                                }
                              : undefined
                          }
                          compact
                        />
                      </motion.div>
                      <motion.div
                        className="pack-back absolute inset-0 flex items-center justify-center rounded-xl"
                        style={{
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                        }}
                        initial={false}
                        animate={{ rotateY: revealed ? 180 : 0 }}
                        transition={{ duration: 0.6, ease: [0.2, 0.9, 0.3, 1] }}
                      >
                        <span className="material-symbols-outlined text-2xl text-secondary-fixed">
                          auto_awesome
                        </span>
                      </motion.div>
                    </div>

                    {isLast && lastCount > 1 && (
                      <motion.span
                        key={lastCount}
                        initial={{ scale: 1.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 12 }}
                        className="absolute top-0 right-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-surface shadow"
                      >
                        ×{lastCount}
                      </motion.span>
                    )}

                    {isLast && lastCount === 1 && (
                      <motion.span
                        layoutId={`batch-ring-${albumCard.id}`}
                        initial={{ scale: 1.4, opacity: 0.8 }}
                        animate={{ scale: 1, opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-secondary"
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>

            {phase === "reveal" && (
              <div className="mt-4 text-center">
                <span className="font-body text-xs text-on-surface-variant/70">
                  {totalUnique}/25 únicas · Toca para saltar
                </span>
              </div>
            )}
          </div>
        )}

        {flatSequence.length === 0 && (
          <p className="mt-6 font-body text-sm text-on-surface-variant">
            No hay cartas para mostrar.
          </p>
        )}

        <AnimatePresence>
          {phase === "adhere" && (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 w-full"
            >
              <p className="mb-2 text-center font-body text-sm font-medium text-on-surface-variant">
                Adherir las cartas a su casilla
              </p>
              <Button
                className="mt-3 w-full"
                disabled={adhering}
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdhere();
                }}
              >
                <span className="material-symbols-outlined mr-2 text-lg">auto_fix_high</span>
                {adhering ? "Pegando..." : "Adherir todo al álbum"}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {phase === "done" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mt-6 w-full"
            >
              <p className="text-center font-display text-xl text-primary">
                ¡Tus cartas ya están pegadas!
              </p>
              <p className="mt-1 text-center font-body text-sm text-on-surface-variant">
                {newCount} nuevas · {dupeCount} repetidas · {totalUnique} únicas
                {foilCount > 0 && (
                  <span className="ml-1 font-semibold text-[#8a6d00]">
                    · {foilCount} ¡FOIL{foilCount > 1 ? "S" : ""}!
                  </span>
                )}
              </p>
              <div className="mt-3 flex w-full gap-3">
                <Button variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); onClose(); }}>
                  Seguir abriendo
                </Button>
                <Button className="flex-1" onClick={(e) => { e.stopPropagation(); onViewAlbum(); }}>
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

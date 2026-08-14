"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { PackReveal } from "./PackReveal";
import { BatchPackReveal } from "./BatchPackReveal";
import { PackTray } from "./PackTray";
import { DailyPackCard } from "./DailyPackCard";
import { usePacks } from "@/hooks/usePacks";
import { useAlbum } from "@/hooks/useAlbum";
import { Button, EmptyState, GlassCard, ZerineDisplay } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";
import type { OpenPackResult, UserPack } from "@/lib/api";

export function PackStore() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { store, loading, buying, opening, exchanging, buy, open, exchange, refresh } = usePacks();
  const { album, collection, duplicates, refresh: refreshAlbum } = useAlbum();
  const [reveal, setReveal] = useState<OpenPackResult | null>(null);
  const [batchReveal, setBatchReveal] = useState<OpenPackResult[] | null>(null);
  const [selectedDupes, setSelectedDupes] = useState<string[]>([]);
  const [batchOpening, setBatchOpening] = useState(false);
  const [batchExchanging, setBatchExchanging] = useState(false);

  const ownedByCardId = Object.fromEntries(
    (collection?.owned ?? []).map((c) => [c.card_id, c])
  );

  const isCompleted = collection ? collection.progress >= collection.total : false;

  const handleBuy = async (packTypeId: string) => {
    await buy(packTypeId);
  };

  const handleOpen = async (pack: UserPack) => {
    const result = await open(pack.id);
    if (result) setReveal(result);
  };

  const handleOpenAll = async () => {
    if (!store?.tray || batchOpening) return;
    const unopened = store.tray.filter((p) => !p.opened);
    if (unopened.length === 0) return;

    setBatchOpening(true);
    const allResults: OpenPackResult[] = [];
    for (const pack of unopened) {
      const result = await open(pack.id);
      if (result) allResults.push(result);
    }
    setBatchOpening(false);
    if (allResults.length > 0) setBatchReveal(allResults);
  };

  const handleAdhere = async () => {
    await refreshAlbum();
  };

  const handleExchange = async () => {
    await exchange(selectedDupes);
    setSelectedDupes([]);
    await refresh();
  };

  const handleExchangeAll = async () => {
    if (!duplicates.length || batchExchanging) return;

    setBatchExchanging(true);

    const available = new Map<string, number>();
    for (const d of duplicates) {
      const dupCount = d.quantity - 1;
      if (dupCount > 0) available.set(d.card_id, dupCount);
    }

    const cardsWithDupes = Array.from(available.entries())
      .filter(([, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    const exchanges: string[][] = [];
    while (cardsWithDupes.length >= 3) {
      const batch = cardsWithDupes.slice(0, 3).map(([id]) => id);
      exchanges.push(batch);
      for (const id of batch) {
        const idx = cardsWithDupes.findIndex(([cid]) => cid === id);
        if (idx >= 0) {
          cardsWithDupes[idx][1] -= 1;
          if (cardsWithDupes[idx][1] === 0) cardsWithDupes.splice(idx, 1);
        }
      }
      cardsWithDupes.sort((a, b) => b[1] - a[1]);
    }

    if (exchanges.length === 0) {
      setBatchExchanging(false);
      return;
    }

    for (const cardIds of exchanges) {
      await exchange(cardIds);
      await new Promise((r) => setTimeout(r, 400));
    }
    setBatchExchanging(false);
    await refresh();
  };

  const toggleDup = (cardId: string) => {
    setSelectedDupes((sel) =>
      sel.includes(cardId) ? sel.filter((id) => id !== cardId) : [...sel, cardId].slice(0, 3)
    );
  };

  const balance = user?.zerines ?? 0;

  if (isCompleted) {
    return (
      <div className="mx-auto w-full max-w-3xl pb-24">
        <EmptyState
          icon="workspace_premium"
          title="Ya completaste este álbum"
          description="Al completar la edición se retiraron tus sobres y duplicados. No puedes comprar más sobres. ¡Espera la próxima edición!"
          actionLabel="Ver mi álbum"
          onAction={() => router.push("/album")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
      <div className="flex justify-end">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.push("/album/ruleta")}>
            <span className="material-symbols-outlined mr-1 text-base">casino</span>
            Ruleta
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push("/album")}>
            <span className="material-symbols-outlined mr-1 text-base">auto_stories</span>
            Álbum
          </Button>
        </div>
      </div>

      {/* Sobre diario gratis */}
      <DailyPackCard onClaimed={refresh} />

      {/* Tienda */}
      <section>
        <h2 className="mb-3 font-display text-lg text-primary">Tienda de sobres</h2>
        {loading && <p className="text-sm text-outline">Cargando tienda…</p>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {(store?.pack_types ?? []).map((pt) => (
            <GlassCard key={pt.id} className="flex flex-col p-4 min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="material-symbols-outlined text-3xl text-secondary">
                  markunread_mailbox
                </span>
                <div>
                  <p className="font-semibold text-primary">{pt.name}</p>
                  <p className="text-[11px] text-outline">
                    {pt.num_cards} cartas
                  </p>
                </div>
              </div>
              <p className="mb-3 min-h-[2.5em] text-xs text-outline">{pt.description}</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {Object.entries(pt.rarity_weights).map(([rarity, weight]) => (
                  <span
                    key={rarity}
                    className="rounded-full bg-secondary/10 px-2 py-0.5 text-[10px] text-secondary"
                  >
                    {rarity.replace("_", " ")} {weight}%
                  </span>
                ))}
              </div>
              <Button
                className="mt-auto w-full"
                disabled={buying || balance < pt.price_zerines}
                onClick={() => handleBuy(pt.id)}
              >
                {balance < pt.price_zerines ? (
                  <>
                    <span className="material-symbols-outlined mr-1 text-base">lock</span>
                    <ZerineDisplay amount={pt.price_zerines} variant="price" />
                  </>
                ) : (
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-base">shopping_bag</span>
                    <span>Comprar ·</span>
                    <span className="flex-1 text-right tabular-nums font-mono text-white/90">
                      {pt.price_zerines.toLocaleString()}
                    </span>
                  </span>
                )}
              </Button>
            </GlassCard>
          ))}
        </div>
      </section>

      {/* Bandeja */}
      <PackTray
        tray={store?.tray ?? []}
        loading={loading}
        opening={opening}
        batchOpening={batchOpening}
        onOpen={handleOpen}
        onOpenAll={handleOpenAll}
      />

      {/* Canje de duplicados */}
      {duplicates.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-1">
            <h2 className="font-display text-lg text-primary">Canje de duplicados</h2>
            <Button
              variant="outline"
              size="sm"
              disabled={
                exchanging ||
                batchExchanging ||
                duplicates.filter((d) => d.quantity >= 2).length < 3
              }
              onClick={handleExchangeAll}
            >
              <span className="material-symbols-outlined mr-1 text-base">swap_horiz</span>
              {batchExchanging ? "Canjeando…" : "Canjear todo"}
            </Button>
          </div>
          <p className="mb-3 text-xs text-outline">
            Selecciona 3 repetidas y cámbialas por un sobre de Lechuza.
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {duplicates.map((dup) => {
              const selected = selectedDupes.includes(dup.card_id);
              return (
                <button
                  key={dup.card_id}
                  onClick={() => toggleDup(dup.card_id)}
                  className={`relative rounded-xl border-2 p-1.5 text-left transition-all active:scale-95 ${
                    selected
                      ? "border-secondary bg-secondary/10"
                      : "border-outline/20 bg-surface-container/40"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="material-symbols-outlined text-2xl text-primary">style</span>
                  <span className="mt-1 block text-[11px] font-medium text-primary">
                    #{dup.slot_number}
                  </span>
                  <span className="block text-[10px] text-outline">×{dup.quantity}</span>
                  {selected && (
                    <span className="absolute right-1 top-1 rounded-full bg-secondary px-1 text-[9px] font-bold text-surface">
                      {selectedDupes.indexOf(dup.card_id) + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <Button
            className="mt-4 w-full sm:w-auto"
            disabled={selectedDupes.length !== 3 || exchanging}
            onClick={handleExchange}
          >
            <span className="material-symbols-outlined mr-1 text-base">swap_horiz</span>
            Canjear {selectedDupes.length}/3 duplicados
          </Button>
        </section>
      )}

      {/* Revelado individual */}
      <AnimatePresence>
        {reveal && album && !batchReveal && (
          <motion.div
            key="reveal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
          >
            <PackReveal
              result={reveal}
              albumCards={album.cards}
              ownedByCardId={ownedByCardId}
              onAdhere={handleAdhere}
              onClose={() => setReveal(null)}
              onViewAlbum={() => {
                const fresh = reveal.cards.filter((c) => c.is_new).map((c) => c.card_id).join(",");
                router.push(`/album?fresh=${fresh}`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Revelado batch (Abrir todo) */}
      <AnimatePresence>
        {batchReveal && album && (
          <motion.div
            key="batch-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60]"
          >
            <BatchPackReveal
              results={batchReveal}
              albumCards={album.cards}
              onAdhere={handleAdhere}
              onClose={() => setBatchReveal(null)}
              onViewAlbum={() => {
                router.push(`/album`);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { AlbumGrid } from "./AlbumGrid";
import { Countdown } from "./Countdown";
import { Button, EmptyState, GlassCard, ProgressBar } from "@/components/ui";
import { useAlbum } from "@/hooks/useAlbum";
import { isStoredUpload } from "@/lib/media";

const RARITY_COLORS: Record<string, string> = {
  common: "bg-outline/60",
  rare: "bg-[#4a7fb5]",
  ultra_rare: "bg-[#c9a227]",
  special: "bg-[#8a63c9]",
  legendary: "bg-[#f0c33c]",
};

export function AlbumPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumId = searchParams.get("id") ?? undefined;
  const { album, collection, duplicates, loading, error, freshCardIds } = useAlbum(albumId);

  const ownedByCardId = useMemo(
    () => Object.fromEntries((collection?.owned ?? []).map((c) => [c.card_id, c])),
    [collection]
  );

  const rarityStats = useMemo(() => {
    const stats = new Map<string, { owned: number; total: number }>();
    for (const card of album?.cards ?? []) {
      const s = stats.get(card.rarity) ?? { owned: 0, total: 0 };
      s.total += 1;
      if (ownedByCardId[card.id]) s.owned += 1;
      stats.set(card.rarity, s);
    }
    return stats;
  }, [album, ownedByCardId]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-outline">Cargando álbum…</p>;
  }

  if (error || !album) {
    return (
      <EmptyState
        icon="auto_stories"
        title="No hay álbum activo"
        description="El administrador aún no ha publicado ninguna edición. ¡Vuelve pronto!"
      />
    );
  }

  const percent = Math.round((collection?.percent ?? 0) * 100) / 100;
  const isCompleted = collection ? collection.progress >= collection.total : false;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      {/* Cabecera */}
      <GlassCard className="relative overflow-hidden p-5">
        <div className="flex items-start gap-4">
          {album.cover_url ? (
            <Image
              src={album.cover_url}
              alt={album.name}
              width={80}
              height={80}
              className="h-20 w-20 shrink-0 rounded-2xl object-cover shadow"
              unoptimized={isStoredUpload(album.cover_url)}
            />
          ) : (
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-primary text-surface shadow">
              <span className="material-symbols-outlined text-4xl">auto_stories</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl text-primary">{album.name}</h1>
            {album.description && (
              <p className="mt-0.5 line-clamp-2 text-xs text-outline">{album.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {album.status === "active" && album.ends_at && (
                <Countdown endsAt={album.ends_at} />
              )}
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isCompleted
                    ? "bg-[#f0c33c]/25 text-[#8a6d00]"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isCompleted ? "¡Álbum completado!" : `${collection?.progress ?? 0}/${collection?.total ?? 0} pegadas`}
              </span>
            </div>
          </div>
        </div>

        {/* Progreso */}
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-outline">
            <span>Progreso</span>
            <span className="font-mono">{percent}%</span>
          </div>
          <ProgressBar value={percent} />
{duplicates.length > 0 && (
            <p className="mt-2 text-[11px] text-secondary">
              Tienes {duplicates.length} repetidas — cámbialas por sobres desde &quot;Abrir sobres&quot;.
            </p>
          )}
        </div>
      </GlassCard>

      {/* Acciones */}
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => router.push("/album/abrir")}>
          <span className="material-symbols-outlined mr-2 text-lg">redeem</span>
          Abrir sobres
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => router.push("/album/ruleta")}>
          <span className="material-symbols-outlined mr-2 text-lg">casino</span>
          Ruleta
        </Button>
      </div>

      {/* Grilla 5×5 */}
      <section>
        <h2 className="mb-3 font-display text-lg text-primary">
          Mi colección
        </h2>
        <AlbumGrid
          cards={album.cards}
          ownedByCardId={ownedByCardId}
          freshCardIds={freshCardIds}
        />
      </section>

      {/* Estadisticas por rareza */}
      <section>
        <h2 className="mb-3 font-display text-lg text-primary">Por rareza</h2>
        <div className="flex flex-wrap gap-2">
          {[...rarityStats.entries()].map(([rarity, s]) => (
            <span
              key={rarity}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-container/60 px-3 py-1.5 text-xs"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${RARITY_COLORS[rarity] ?? "bg-outline"}`} />
              <span className="font-medium capitalize text-primary">{rarity.replace("_", " ")}</span>
              <span className="font-mono text-outline">
                {s.owned}/{s.total}
              </span>
            </span>
          ))}
        </div>
      </section>

      <p className="text-center text-[11px] text-outline">
        {album.status === "active" && album.ends_at
          ? "Al cerrar la edición las cartas quedarán guardadas para siempre."
          : "Edición cerrada — colección archivada."}
      </p>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { AlbumGrid } from "@/components/album/AlbumGrid";
import { Countdown } from "@/components/album/Countdown";
import { EmptyState, GlassCard, ProgressBar } from "@/components/ui";
import { api } from "@/lib/api";
import { toastError } from "@/lib/toastStore";
import type { AlbumCard as AlbumCardType, AlbumCollection } from "@/lib/api";

export default function FriendAlbumPage() {
  const params = useParams<{ userId: string }>();
  const [data, setData] = useState<AlbumCollection | null>(null);
  const [cards, setCards] = useState<AlbumCardType[]>([]);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const album = await api.getActiveAlbum();
        const [col, detail, owner] = await Promise.all([
          api.getCollection(album.id, params.userId),
          api.getAlbum(album.id),
          api.getUser(params.userId),
        ]);
        setData(col);
        setCards(detail.cards);
        setOwnerName(owner.name);
      } catch (e) {
        toastError("No se pudo cargar el álbum del amigo", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [params.userId]);

  if (loading) {
    return <p className="py-10 text-center text-sm text-outline">Cargando álbum…</p>;
  }

  if (!data) {
    return (
      <EmptyState
        icon="auto_stories"
        title="Sin álbum activo"
        description="Esta persona aún no tiene una edición activa que mostrar."
      />
    );
  }

  const ownedByCardId = Object.fromEntries(data.owned.map((c) => [c.card_id, c]));

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      <GlassCard className="p-5">
        <h1 className="font-display text-2xl text-primary">
          Álbum de {ownerName}
        </h1>
        <p className="mt-0.5 text-xs text-outline">{data.album.name}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {data.album.status === "active" && data.album.ends_at && (
            <Countdown endsAt={data.album.ends_at} />
          )}
          <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
            {data.progress}/{data.total} pegadas
          </span>
        </div>
        <div className="mt-3">
          <ProgressBar value={data.percent} />
          <p className="mt-1 text-right font-mono text-xs text-outline">
            {data.percent}%
          </p>
        </div>
      </GlassCard>

      <AlbumGrid cards={cards} ownedByCardId={ownedByCardId} />
    </div>
  );
}
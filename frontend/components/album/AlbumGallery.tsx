"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Countdown } from "./Countdown";
import { EmptyState, GlassCard, ProgressBar } from "@/components/ui";
import { api } from "@/lib/api";
import { isStoredUpload } from "@/lib/media";
import { toastError } from "@/lib/toastStore";
import type { AlbumGalleryItem } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  completed: "Completada",
};

export function AlbumGallery() {
  const router = useRouter();
  const [albums, setAlbums] = useState<AlbumGalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getGallery()
      .then(setAlbums)
      .catch((e) => toastError("No se pudieron cargar los álbumes", e))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="py-10 text-center text-sm text-outline">Cargando álbumes…</p>;
  }

  if (albums.length === 0) {
    return (
      <EmptyState
        icon="auto_stories"
        title="Todavía no hay álbumes"
        description="Cuando el administrador publique una edición, aparecerá aquí."
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-5 pb-24">
      <div className="flex flex-col gap-2">
          <h1 className="font-display text-headline-lg md:text-display-lg text-primary">Pictorium</h1>
          <p className="text-body-md text-on-surface-variant">
            Cada edición dura 2 semanas. Al cerrarse, tu colección queda archivada.
          </p>
        </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {albums.map((album) => {
          const completed = album.percent >= 100;
          return (
            <button
              key={album.id}
              onClick={() => router.push(`/album?id=${album.id}`)}
              className={`group overflow-hidden rounded-2xl text-left transition-all hover:-translate-y-1 active:scale-95 ${
                completed ? "ring-2 ring-[#c9a227]" : ""
              }`}
            >
              <GlassCard className="h-full p-0">
                <div
                  className={`relative flex h-24 items-center justify-center overflow-hidden ${
                    completed ? "bg-[#c9a227]/20" : "bg-primary/10"
                  }`}
                >
                  {album.cover_url ? (
                    <Image
                      src={album.cover_url}
                      alt={album.name}
                      fill
                      sizes="(max-width: 768px) 45vw, 300px"
                      className="object-cover"
                      unoptimized={isStoredUpload(album.cover_url)}
                    />
                  ) : (
                    <span
                      className={`material-symbols-outlined text-4xl ${
                        completed ? "text-[#8a6d00]" : "text-primary"
                      }`}
                    >
                      auto_stories
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <p className="truncate text-sm font-semibold text-primary">{album.name}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1"><ProgressBar value={album.percent} size="sm" /></div>
                    <span className="font-mono text-[11px] text-outline">
                      {album.progress}/{album.total_cards}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        album.status === "active"
                          ? "bg-emerald-600/15 text-emerald-700"
                          : completed
                            ? "bg-[#c9a227]/25 text-[#8a6d00]"
                            : "bg-outline/15 text-outline"
                      }`}
                    >
                      {completed ? "¡Completado!" : STATUS_LABEL[album.status] ?? album.status}
                    </span>
                    {album.status === "active" && album.ends_at && (
                      <Countdown endsAt={album.ends_at} compact />
                    )}
                  </div>
                </div>
              </GlassCard>
            </button>
          );
        })}
      </div>
    </div>
  );
}
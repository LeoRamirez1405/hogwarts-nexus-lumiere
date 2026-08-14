"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { toastError } from "@/lib/toastStore";
import type {
  AlbumDetail,
  AlbumCollection,
  CollectionCard,
} from "@/lib/api";

export interface UseAlbumReturn {
  album: AlbumDetail | null;
  collection: AlbumCollection | null;
  duplicates: CollectionCard[];
  loading: boolean;
  error: string | null;
  freshCardIds: string[];
  refresh: () => Promise<void>;
}

export function useAlbum(albumId?: string): UseAlbumReturn {
  const [album, setAlbum] = useState<AlbumDetail | null>(null);
  const [collection, setCollection] = useState<AlbumCollection | null>(null);
  const [duplicates, setDuplicates] = useState<CollectionCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [freshCardIds] = useState<string[]>(() =>
    typeof window !== "undefined"
      ? (new URLSearchParams(window.location.search).get("fresh") ?? "").split(",").filter(Boolean)
      : []
  );

  const fetchAll = useCallback(async () => {
    const detail = albumId
      ? await api.getAlbum(albumId)
      : await api.getActiveAlbum();
    if (!detail) return null;
    const [col, dupes] = await Promise.all([
      api.getCollection(detail.id),
      api.getDuplicates(detail.id),
    ]);
    return { detail, col, dupes };
  }, [albumId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAll();
        if (cancelled || !data) return;
        setAlbum(data.detail);
        setCollection(data.col);
        setDuplicates(data.dupes);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        setError("No se pudo cargar el álbum");
        toastError("No se pudo cargar el álbum", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchAll]);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchAll();
      if (!data) return;
      setAlbum(data.detail);
      setCollection(data.col);
      setDuplicates(data.dupes);
      setError(null);
    } catch (e) {
      toastError("No se pudo actualizar el álbum", e);
    }
  }, [fetchAll]);

  return { album, collection, duplicates, loading, error, freshCardIds, refresh };
}
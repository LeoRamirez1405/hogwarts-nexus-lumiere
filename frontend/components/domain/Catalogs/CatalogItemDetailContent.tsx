"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { CatalogItem } from "@/lib/api";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { Button } from "@/components/ui";

interface CatalogItemDetailContentProps {
  item: CatalogItem;
  onToggleFavorite: (item: CatalogItem) => void;
}

export const CatalogItemDetailContent = memo(function CatalogItemDetailContent({
  item,
  onToggleFavorite,
}: CatalogItemDetailContentProps) {
  const theme = useTheme();
  const fallbackSrc = getFallbackImageByContext("artifact", theme);
  const [imgError, setImgError] = useState(false);
  const src = !imgError && item.image_url ? item.image_url : fallbackSrc;

  return (
    <div className="space-y-5">
      <div className="relative h-72 rounded-2xl overflow-hidden">
        <Image
          src={src}
          alt={`Elemento #${item.numero}`}
          fill
          className="object-cover"
          unoptimized={isStoredUpload(src)}
          onError={() => setImgError(true)}
        />
        <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm">
          # {item.numero}
        </span>
      </div>

      <div className="space-y-3">
        <p className="text-label-sm text-secondary font-bold">N.º {item.numero}</p>
        <h2 className="font-display text-headline-lg text-primary">
          Elemento #{item.numero}
        </h2>
        <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
          {item.description || "Sin descripción"}
        </div>
      </div>

      <div className="pt-4 border-t border-outline-variant/30 flex items-center justify-between gap-3">
        <p className="text-body-sm text-on-surface-variant">
          {item.is_favorite
            ? "Está en tus favoritos"
            : "Guárdalo para encontrarlo rápido"}
        </p>
        <Button
          variant={item.is_favorite ? "secondary" : "outline"}
          icon={item.is_favorite ? "favorite" : "favorite_border"}
          onClick={() => onToggleFavorite(item)}
        >
          {item.is_favorite ? "En favoritos" : "Favorito"}
        </Button>
      </div>
    </div>
  );
});

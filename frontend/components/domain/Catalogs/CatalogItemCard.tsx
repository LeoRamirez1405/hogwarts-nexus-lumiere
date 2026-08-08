"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { CatalogItem } from "@/lib/api";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { MaterialIcon } from "@/components/ui";

interface CatalogItemCardProps {
  item: CatalogItem;
  onToggleFavorite: (item: CatalogItem) => void;
  onSelect?: (item: CatalogItem) => void;
}

export const CatalogItemCard = memo(function CatalogItemCard({
  item,
  onToggleFavorite,
  onSelect,
}: CatalogItemCardProps) {
  const theme = useTheme();
  const fallbackSrc = getFallbackImageByContext("artifact", theme);
  const [src, setSrc] = useState<string>(item.image_url || fallbackSrc);

  const handleImageError = () => {
    if (src !== fallbackSrc) setSrc(fallbackSrc);
  };

  return (
    <div
      className="glass-card rounded-3xl overflow-hidden group hover:-translate-y-2 active:scale-[0.98] transition-all duration-300 cursor-pointer flex flex-col h-80"
      onClick={() => onSelect?.(item)}
    >
      <div className="relative flex-1 min-h-56">
        <Image
          src={src}
          alt={`Elemento #${item.numero}`}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized={
            src.startsWith("http://localhost:8000/uploads/") ||
            src.startsWith("/fallbacks/")
          }
          onError={handleImageError}
        />
        <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm">
          # {item.numero}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(item);
          }}
          aria-label={item.is_favorite ? "Quitar de favoritos" : "Añadir a favoritos"}
          className={`absolute top-4 right-4 w-10 h-10 inline-flex items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all active:scale-90 ${
            item.is_favorite
              ? "bg-secondary text-on-secondary"
              : "bg-white/90 text-secondary hover:bg-white"
          }`}
        >
          <MaterialIcon
            name={item.is_favorite ? "favorite" : "favorite_border"}
            className="text-xl"
          />
        </button>
      </div>
      {item.description && (
        <div className="p-4">
          <p className="text-label-sm text-secondary font-bold mb-1">
            N.º {item.numero}
          </p>
          <p className="text-body-md text-on-surface-variant line-clamp-2">
            {item.description}
          </p>
        </div>
      )}
    </div>
  );
});

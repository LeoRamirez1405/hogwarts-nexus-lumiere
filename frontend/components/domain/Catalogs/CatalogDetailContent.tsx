"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Catalog } from "@/lib/api";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { Button, MaterialIcon } from "@/components/ui";

interface CatalogDetailContentProps {
  catalog: Catalog;
  onExplore: (catalog: Catalog) => void;
}

export const CatalogDetailContent = memo(function CatalogDetailContent({
  catalog,
  onExplore,
}: CatalogDetailContentProps) {
  const theme = useTheme();
  const fallbackSrc = getFallbackImageByContext("generic", theme);
  const [imgError, setImgError] = useState(false);
  const src =
    !imgError && catalog.cover_image_url ? catalog.cover_image_url : fallbackSrc;

  return (
    <div className="space-y-5">
      <div className="relative h-56 rounded-2xl overflow-hidden">
        <Image
          src={src}
          alt={catalog.name}
          fill
          className="object-cover"
          unoptimized={
            src.startsWith("http://localhost:8000/uploads/") ||
            src.startsWith("/fallbacks/")
          }
          onError={() => setImgError(true)}
        />
        <span className="absolute top-4 right-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm flex items-center gap-1">
          <MaterialIcon name="grid_view" className="text-[1em]" />
          {catalog.item_count} elementos
        </span>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-headline-lg text-primary">
          {catalog.name}
        </h2>
        <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
          {catalog.description || "Sin descripción"}
        </div>
      </div>

      <div className="pt-4 border-t border-outline-variant/30">
        <Button
          variant="primary"
          icon="arrow_forward"
          iconPosition="right"
          className="w-full"
          onClick={() => onExplore(catalog)}
        >
          Explorar catálogo
        </Button>
        <p className="text-label-sm text-on-surface-variant text-center mt-3">
          Al pedir algo en Flourish &amp; Blotts, escribe en la especificación el
          catálogo y el número del elemento (ej: &quot;{catalog.name}, nº 14&quot;).
        </p>
      </div>
    </div>
  );
});

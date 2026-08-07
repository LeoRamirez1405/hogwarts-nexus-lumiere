"use client";

import { memo } from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { ZerineDisplay } from "@/components/ui";
import { useTheme } from "@/lib/useTheme";

interface ProductDetailContentProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const ProductDetailContent = memo(function ProductDetailContent({
  product,
  onAddToCart,
}: ProductDetailContentProps) {
  const theme = useTheme();
  const fallbackSrc = getFallbackImageByContext("artifact", theme);
  const imageSrc = product.image_url || fallbackSrc;

  return (
    <div className="space-y-5">
      {product.image_url && (
        <div className="relative h-64 rounded-2xl overflow-hidden">
          <Image
            src={imageSrc}
            alt={product.name}
            fill
            className="object-cover"
            unoptimized={imageSrc.startsWith("http://localhost:8000/uploads/") || imageSrc.startsWith("/fallbacks/")}
          />
          <span className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-secondary-fixed text-label-sm uppercase px-3 py-1 rounded-full">
            {product.category}
          </span>
          {product.category?.toLowerCase().includes("maldito") && (
            <span className="absolute top-4 right-4 bg-error/80 backdrop-blur-md text-on-error text-label-sm uppercase px-3 py-1 rounded-full">
              Maldito
            </span>
          )}
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-headline-lg text-surface">{product.name}</h2>

        <div className="text-surface-dim text-body-md whitespace-pre-wrap leading-relaxed">
          {product.description}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-secondary/20">
          <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary-fixed text-label-sm font-medium">
            {product.category}
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-label-sm font-medium">
            Borgin & Burkes
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-secondary/20">
          <div>
            <p className="text-surface-dim">Stock disponible</p>
            <p className="font-semibold text-surface">{product.stock}</p>
          </div>
          <div>
            <p className="text-surface-dim">Popularidad (semana)</p>
            <p className="font-semibold text-surface">{product.weekly_sales ?? 0}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-secondary/20">
          <ZerineDisplay amount={product.price} iconStyle="icon" variant="price" />
          <button
            onClick={() => onAddToCart(product)}
            className="border border-secondary text-secondary rounded-full px-6 py-2 text-label-sm font-bold hover:bg-secondary hover:text-on-secondary-fixed transition-all active:scale-95"
          >
            Añadir a la Cesta
          </button>
        </div>
      </div>
    </div>
  );
});
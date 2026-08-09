"use client";

import { memo } from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { getFallbackForProduct } from "@/lib/fallbacks";
import { ZerineDisplay, Button } from "@/components/ui";
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
  const fallbackSrc = getFallbackForProduct("flourish", theme);
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
          <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm">
            {product.category}
          </span>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-display text-headline-lg text-primary">{product.name}</h2>

        <div className="text-on-surface-variant text-body-md whitespace-pre-wrap leading-relaxed">
          {product.description}
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-outline-variant/30">
          <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-label-sm font-medium">
            {product.category}
          </span>
          <span className="px-3 py-1 rounded-full bg-secondary/10 text-secondary text-label-sm font-medium">
            {product.shop === "flourish" ? "Flourish & Blotts" : "Borgin & Burkes"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm pt-2 border-t border-outline-variant/30">
          <div>
            <p className="text-on-surface-variant">Stock disponible</p>
            <p className="font-semibold text-on-surface">{product.stock}</p>
          </div>
          <div>
            <p className="text-on-surface-variant">Popularidad (semana)</p>
            <p className="font-semibold text-on-surface">{product.weekly_sales ?? 0}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-outline-variant/30">
          <ZerineDisplay amount={product.price} variant="price" iconStyle="icon" />
          <Button
            onClick={() => onAddToCart(product)}
          >
            Añadir al Caldero
          </Button>
        </div>
      </div>
    </div>
  );
});
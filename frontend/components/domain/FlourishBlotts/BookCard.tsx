"use client";

import { memo, useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { getFallbackForProduct } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { ZerineDisplay } from "@/components/ui";

interface BookCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export const BookCard = memo(function BookCard({
  product,
  onAddToCart,
}: BookCardProps) {
  const theme = useTheme();
  const fallbackSrc = getFallbackForProduct("flourish", theme);
  const [src, setSrc] = useState<string>(() => product.image_url || fallbackSrc);

  // Safe fallback: on error, swap src to the bundled placeholder and stop.
  // Never toggles a boolean in state, so there is no onError render loop.
  const handleImageError = () => {
    if (src !== fallbackSrc) setSrc(fallbackSrc);
  };

  return (
    <div className="glass-card rounded-3xl p-6 group cursor-pointer hover:-translate-y-2 transition-all duration-300">
      <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
        <Image
          src={src}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized={src.startsWith("http://localhost:8000/uploads/") || src.startsWith("/fallbacks/")}
          onError={handleImageError}
        />
        <span className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm">
          {product.category}
        </span>
      </div>
      <h3 className="font-display text-headline-lg text-primary mb-1">
        {product.name}
      </h3>
      <p className="text-on-surface-variant text-body-md line-clamp-2 mb-4">
        {product.description}
      </p>
      <div className="flex items-center justify-between">
        <ZerineDisplay amount={product.price} variant="price" iconStyle="icon" />
        <button
          onClick={() => onAddToCart(product)}
          className="border border-primary text-primary rounded-full px-6 py-2 text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95"
        >
          Añadir al Caldero
        </button>
      </div>
    </div>
  );
});

"use client";

import { useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { ZerineDisplay } from "@/components/ui";
import { getFallbackImageByContext } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";

interface ArtifactCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function ArtifactCard({ product, onAddToCart }: ArtifactCardProps) {
  const [imageError, setImageError] = useState(false);
  const theme = useTheme();

  const fallbackSrc = getFallbackImageByContext('artifact', theme);

  return (
    <div className="group cursor-pointer hover:-translate-y-2 transition-all duration-300 bg-[#2a2828] border border-secondary/20 rounded-3xl p-6">
      <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
        <Image
          src={product.image_url || fallbackSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/") || product.image_url?.startsWith("/fallbacks/")}
          onError={() => !imageError && setImageError(true)}
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
      <h3 className="font-display text-headline-lg text-surface mb-1">
        {product.name}
      </h3>
      <p className="text-surface-dim text-body-md line-clamp-2 mb-4">
        {product.description}
      </p>
      <div className="flex items-center justify-between">
        <ZerineDisplay amount={product.price} iconStyle="icon" variant="price" />
        <button
          onClick={() => onAddToCart(product)}
          className="border border-secondary text-secondary rounded-full px-6 py-2 text-label-sm font-bold hover:bg-secondary hover:text-on-secondary-fixed transition-all active:scale-95"
        >
          Añadir a la Cesta
        </button>
      </div>
    </div>
  );
}
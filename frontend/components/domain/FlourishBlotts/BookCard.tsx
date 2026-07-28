"use client";

import { useState } from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { getFallbackForProduct } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { ZerineDisplay } from "@/components/ui";

interface BookCardProps {
  product: Product;
  onAddToCart: (product: Product) => void;
}

export function BookCard({ product, onAddToCart }: BookCardProps) {
  const theme = useTheme();
  const [imageError, setImageError] = useState(false);

  const fallbackSrc = getFallbackForProduct('flourish', theme);

  return (
    <div className="glass-card rounded-3xl p-6 group cursor-pointer hover:-translate-y-2 transition-all duration-300">
      <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
        <Image
          src={product.image_url || fallbackSrc}
          alt={product.name}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-500"
          unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/") || product.image_url?.startsWith("/fallbacks/")}
          onError={() => !imageError && setImageError(true)}
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
}
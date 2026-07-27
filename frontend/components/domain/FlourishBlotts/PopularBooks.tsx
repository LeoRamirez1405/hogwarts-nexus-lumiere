"use client";

import { MaterialIcon } from "@/components/ui";
import { BookCard } from "./BookCard";

interface PopularBooksProps {
  products: import("@/lib/api").Product[];
  onAddToCart: (product: import("@/lib/api").Product) => void;
}

export function PopularBooks({ products, onAddToCart }: PopularBooksProps) {
  if (products.length === 0) return null;

  return (
    <section className="mb-16" aria-labelledby="popular-heading">
      <h2 id="popular-heading" className="font-display text-headline-lg text-on-surface mb-4 flex items-center gap-3">
        <MaterialIcon name="local_fire_department" className="text-secondary" filled />
        Popular entre Prefectos
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {products.map((product) => (
          <div key={product.id} className="shrink-0">
            <BookCard product={product} onAddToCart={onAddToCart} />
          </div>
        ))}
      </div>
    </section>
  );
}
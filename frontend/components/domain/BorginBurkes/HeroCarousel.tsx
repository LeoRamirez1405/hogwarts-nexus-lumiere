"use client";

import React from "react";
import Image from "next/image";
import { Product } from "@/lib/api";
import { ZerineDisplay, MaterialIcon } from "@/components/ui";
import { getFallbackForProduct, detectTheme } from "@/lib/fallbacks";
import { useSwipeable, useReducedMotion } from "@/hooks/useGestures";
import { useRef } from "react";

type SlideType = { type: "product"; product: Product } | { type: "info" };

interface HeroCarouselProps {
  displaySlides: SlideType[];
  totalSlides: number;
  currentSlide: number;
  isJumping: boolean;
  trackRef: React.RefObject<HTMLDivElement | null>;
  onNextSlide: () => void;
  onPrevSlide: () => void;
  onGoToSlide: (index: number) => void;
  onTrackTransitionEnd: (e: React.TransitionEvent<HTMLDivElement>) => void;
  userZerines?: number;
  getCount: () => number;
  onToggleCart: () => void;
  onScrollToCatalog: () => void;
  onAddToCart: (product: Product) => void;
}

function ProductSlide({ product, displaySlidesLength, onAddToCart, index }: {
  product: Product;
  displaySlidesLength: number;
  onAddToCart: (product: Product) => void;
  index: number;
}) {
  const fallbackSrc = getFallbackForProduct('borgin', detectTheme());
  const [imgSrc, setImgSrc] = React.useState(product.image_url || fallbackSrc);
  return (
    <div className="shrink-0" style={{ width: `${100 / displaySlidesLength}%` }}>
      <div className="relative rounded-2xl overflow-hidden border border-secondary/20 h-full">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-8 md:p-12 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <MaterialIcon name="storefront" className="text-secondary text-3xl" filled />
            <span className="text-secondary-fixed-dim text-label-sm uppercase tracking-[0.2em]">Knockturn</span>
          </div>
          <div className="flex-1 flex items-start md:items-center">
            <div className="w-full">
              <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
                <Image
                  src={imgSrc}
                  alt={product.name}
                  fill
                  className="object-cover"
                  unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/") || imgSrc.startsWith("/fallbacks/")}
                  onError={() => { if (imgSrc !== fallbackSrc) setImgSrc(fallbackSrc); }}
                  sizes="(max-width: 768px) 100vw, 50vw"
                  priority={index === 0}
                />
                <span className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-secondary-fixed text-label-sm uppercase px-3 py-1 rounded-full">
                  {product.category}
                </span>
                {product.category?.toLowerCase().includes("maldito") && (
                  <span className="absolute top-4 left-4 bg-error/80 backdrop-blur-md text-on-error text-label-sm uppercase px-3 py-1 rounded-full">
                    Maldito
                  </span>
                )}
              </div>
              <h2 className="font-display text-headline-lg text-surface mb-2">{product.name}</h2>
              <p className="text-surface-dim text-body-md line-clamp-3 mb-4">{product.description}</p>
              <div className="flex items-center gap-4">
                <ZerineDisplay amount={product.price} iconStyle="icon" variant="price" size="lg" />
                <button
                  onClick={() => onAddToCart(product)}
                  className="bg-transparent border border-secondary text-secondary font-bold rounded-xl px-6 py-3 text-label-sm hover:bg-secondary hover:text-on-secondary-fixed transition-all active:scale-95"
                >
                  Añadir a la Cesta
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoSlide({ displaySlidesLength, userZerines, getCount, onToggleCart, onScrollToCatalog }: {
  displaySlidesLength: number;
  userZerines?: number;
  getCount: () => number;
  onToggleCart: () => void;
  onScrollToCatalog: () => void;
}) {
  return (
    <div className="shrink-0" style={{ width: `${100 / displaySlidesLength}%` }}>
      <div className="relative rounded-2xl overflow-hidden border border-secondary/20 h-full bg-linear-to-br from-[#1c1b1b] via-[#2a2828] to-[#1c1b1b]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-8 md:p-12 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <MaterialIcon name="storefront" className="text-secondary text-3xl" filled />
            <span className="text-secondary-fixed-dim text-label-sm uppercase tracking-[0.2em]">Knockturn</span>
          </div>
          <h1 className="font-display text-headline-lg md:text-display-lg text-surface mb-2">
            Borgin & Burkes
          </h1>
          <p className="text-surface-dim text-body-md max-w-xl mb-8">
            Objetos de las Artes Oscuras y Reliquias Raras. Proceda bajo su propio riesgo.
          </p>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 w-full mt-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <button
                onClick={onScrollToCatalog}
                className="bg-secondary text-on-secondary rounded-full px-6 py-3 font-medium text-body-md hover:opacity-90 transition-all active:scale-95"
              >
                Ver Catálogo Oscuro
              </button> 
            </div>

            <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-secondary/20">
              <div className="flex items-center gap-2">
                <MaterialIcon name="diamond" className="text-secondary-fixed text-[1.2em]" filled />
                <span className="text-secondary-fixed text-body-md font-medium">
                  {userZerines?.toLocaleString() ?? "0"} Zerines
                </span>
              </div>
            </div>

            {getCount() > 0 && (
              <button
                onClick={onToggleCart}
                className="relative flex items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-secondary/20 text-secondary-fixed hover:bg-surface-container-high transition-colors"
              >
                <MaterialIcon name="shopping_cart" className="text-[1.2em]" />
                <span className="text-body-md font-medium">{getCount()}</span>
                <span className="absolute -top-2 -right-2 bg-secondary text-on-secondary text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {getCount()}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroCarousel({
  displaySlides,
  totalSlides,
  currentSlide,
  isJumping,
  onNextSlide,
  onPrevSlide,
  onGoToSlide,
  onTrackTransitionEnd,
  userZerines,
  getCount,
  onToggleCart,
  onScrollToCatalog,
  onAddToCart,
}: HeroCarouselProps) {
  const prefersReducedMotion = useReducedMotion();
  const swipeRef = useRef<HTMLDivElement>(null);

  const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useSwipeable({
    onSwipeLeft: onNextSlide,
    onSwipeRight: onPrevSlide,
    threshold: 50,
    disabled: prefersReducedMotion,
  });

  return (
    <div className="max-w-7xl mx-auto mb-10">
      <div className="relative overflow-hidden">
        <div
          ref={swipeRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          className="flex transition-transform ease-out"
          style={{
            transform: `translateX(-${currentSlide * (100 / Math.max(displaySlides.length, 1))}%)`,
            width: `${displaySlides.length * 100}%`,
            transitionDuration: isJumping ? "0ms" : "800ms",
          }}
          onTransitionEnd={onTrackTransitionEnd}
        >
          {displaySlides.map((slide, i) =>
            slide.type === "product" ? (
              <ProductSlide
                key={`slide-${i}`}
                product={slide.product}
                displaySlidesLength={displaySlides.length}
                onAddToCart={onAddToCart}
                index={i}
              />
            ) : (
              <InfoSlide
                key={`info-${i}`}
                displaySlidesLength={displaySlides.length}
                userZerines={userZerines}
                getCount={getCount}
                onToggleCart={onToggleCart}
                onScrollToCatalog={onScrollToCatalog}
              />
            )
          )}
        </div>

        <button
          onClick={onPrevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-inverse-surface/70 backdrop-blur-md text-secondary flex items-center justify-center hover:bg-inverse-surface/90 transition-colors z-10 shadow-lg border border-secondary/20"
          aria-label="Previous"
        >
          <MaterialIcon name="chevron_left" className="text-2xl" />
        </button>
        <button
          onClick={onNextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-inverse-surface/70 backdrop-blur-md text-secondary flex items-center justify-center hover:bg-inverse-surface/90 transition-colors z-10 shadow-lg border border-secondary/20"
          aria-label="Next"
        >
          <MaterialIcon name="chevron_right" className="text-2xl" />
        </button>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              onClick={() => onGoToSlide(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === ((currentSlide - 1 + totalSlides) % totalSlides)
                  ? "bg-secondary w-6"
                  : "bg-gray-600 hover:bg-gray-400"
              }`}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
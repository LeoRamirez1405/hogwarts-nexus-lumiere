"use client";

import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { memo, useRef } from "react";
import { MaterialIcon, ZerineDisplay } from "@/components/ui";
import { getFallbackForProduct, type Theme } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import type { Product } from "@/lib/api";
import { useSwipeable, useReducedMotion } from "@/hooks/useGestures";

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
  getCount: () => number;
  onToggleCart: () => void;
  onCatalogScroll: () => void;
  onAddToCart: (product: Product) => void;
}

const ProductSlide = memo(function ProductSlide({
  product,
  displaySlidesLength,
  theme,
  onAddToCart,
  index,
}: {
  product: Product;
  displaySlidesLength: number;
  theme: Theme;
  onAddToCart: (product: Product) => void;
  index: number;
}) {
  const fallbackSrc = getFallbackForProduct('flourish', theme);
  return (
    <div className="shrink-0" style={{ width: `${100 / displaySlidesLength}%` }}>
      <div className="relative rounded-3xl overflow-hidden glass-card border border-lilac-200 h-full">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#8e44ad]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-6 md:p-10 h-full flex flex-col">
          <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6">
            <Image
              src={product.image_url || fallbackSrc}
              alt={product.name}
              fill
              className="object-cover"
              unoptimized={isStoredUpload(product.image_url) || isStoredUpload(imgSrc)}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority={index === 0}
            />
            <span className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm text-primary text-label-sm uppercase px-3 py-1 rounded-full">
              {product.category}
            </span>
          </div>
          <h2 className="font-display text-headline-lg text-primary mb-3">{product.name}</h2>
          <p className="text-on-surface-variant text-body-md mb-6 line-clamp-4">
            {product.description}
          </p>
          <div className="flex flex-wrap items-center gap-4 mt-auto">
            <ZerineDisplay amount={product.price} iconStyle="icon" variant="price" size="lg" />
            <button
              onClick={() => onAddToCart(product)}
              className="border border-primary text-primary rounded-full px-6 py-3 text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95"
            >
              Añadir al Caldero
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

const InfoSlide = memo(function InfoSlide({
  displaySlidesLength,
  getCount,
  onToggleCart,
  onCatalogScroll,
}: {
  displaySlidesLength: number;
  getCount: () => number;
  onToggleCart: () => void;
  onCatalogScroll: () => void;
}) {
  return (
    <div className="shrink-0" style={{ width: `${100 / displaySlidesLength}%` }}>
      <div className="relative rounded-3xl overflow-hidden glass-card border border-lilac-200 h-full">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-md h-112 bg-[#8e44ad]/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: "radial-gradient(circle at 2px 2px, rgba(119,90,25,0.4) 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }} />
        <div className="relative z-10 p-8 md:p-14 h-full flex flex-col justify-center items-start text-left max-w-3xl">
          <div className="flex items-center gap-3 mb-4">
            <span
              className="material-symbols-outlined text-[#8e44ad] text-4xl"
              style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}
            >
              menu_book
            </span>
            <span className="text-[#8e44ad] text-label-sm uppercase tracking-[0.25em] font-semibold">
              Librería Mágica · Est. 1454
            </span>
          </div>
          <h1 className="font-display text-headline-lg md:text-display-lg text-primary mb-4 leading-tight">
            Flourish & Blotts
          </h1>
          <p className="text-on-surface-variant text-body-md mb-8 leading-relaxed">
            La librería más antigua del Callejón Diagon. Desde 1454 surtiendo a magos y
            brujas con los mejores grimorios, encantamientos y tratados de botánica.
            Acércate a nuestra estantería ambulante y descubre la próxima edición de
            tu saga favorita.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={onCatalogScroll}
              className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold text-body-md hover:opacity-90 transition-all active:scale-95 shadow-md"
            >
              Explorar Catálogo
            </button>
            {getCount() > 0 && (
              <button
                onClick={onToggleCart}
                className="relative flex items-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-full border border-lilac-300 text-[#8e44ad] hover:bg-white transition-colors font-medium"
              >
                <MaterialIcon name="shopping_cart" className="text-[1.1em]" />
                Mi Caldero ({getCount()})
                <span className="absolute -top-2 -right-2 bg-[#8e44ad] text-on-primary text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                  {getCount()}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export function HeroCarousel({
  displaySlides,
  totalSlides,
  currentSlide,
  isJumping,
  onNextSlide,
  onPrevSlide,
  onGoToSlide,
  onTrackTransitionEnd,
  getCount,
  onToggleCart,
  onCatalogScroll,
  onAddToCart,
}: HeroCarouselProps) {
  const theme = useTheme();
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
                theme={theme}
                onAddToCart={onAddToCart}
                index={i}
              />
            ) : (
              <InfoSlide
                key={`info-${i}`}
                displaySlidesLength={displaySlides.length}
                getCount={getCount}
                onToggleCart={onToggleCart}
                onCatalogScroll={onCatalogScroll}
              />
            )
          )}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={onPrevSlide}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 backdrop-blur-md text-[#8e44ad] flex items-center justify-center hover:bg-white/90 transition-colors z-10 shadow-lg"
          aria-label="Previous"
        >
          <MaterialIcon name="chevron_left" className="text-2xl" />
        </button>
        <button
          onClick={onNextSlide}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 backdrop-blur-md text-[#8e44ad] flex items-center justify-center hover:bg-white/90 transition-colors z-10 shadow-lg"
          aria-label="Next"
        >
          <MaterialIcon name="chevron_right" className="text-2xl" />
        </button>

        {/* Dots */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
          {Array.from({ length: totalSlides }).map((_, i) => {
            const displayIndex = i + 1;
            const isActive =
              currentSlide === displayIndex ||
              (currentSlide === 0 && i === totalSlides - 1) ||
              (currentSlide === displaySlides.length - 1 && i === 0);
            return (
              <button
                key={i}
                onClick={() => onGoToSlide(i)}
                className={`w-2 h-2 rounded-full transition-all ${isActive ? "bg-[#8e44ad] w-6" : "bg-gray-300 hover:bg-gray-400"}`}
                aria-label={`Slide ${i + 1}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
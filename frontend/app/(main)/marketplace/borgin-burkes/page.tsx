"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { api, Product } from "@/lib/api";
import { useCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import SearchBar from "@/components/ui/SearchBar";

type SlideType = { type: "product"; product: Product } | { type: "info" };

const BORGIN_FILTERS = [
  "Todos",
  "Reliquia Rara",
  "Objeto Oscuro",
  "Reliquia Historica",
  "Artefacto",
  "Curiosidad",
  "Reliquia Oscura",
  "Objeto Maldito",
  "Varita",
];

export default function BorginBurkesPage() {
  const { user, setUser } = useAuthStore();
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } =
    useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [currentSlide, setCurrentSlide] = useState(1); // Start at 1 (real first slide with duplicates)
  const [isHovering, setIsHovering] = useState(false);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Filter products based on search and category
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "Todos" || p.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

  useEffect(() => {
    api
      .getProducts("borgin")
      .then((allProducts) => {
        setProducts(allProducts);
        // Carousel: 3 random featured products + 1 info slide
        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
        const featured = shuffled.slice(0, 3);
        const newSlides: SlideType[] = featured.map((p) => ({ type: "product", product: p }));
        newSlides.push({ type: "info" });
        setSlides(newSlides);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Compute display slides with duplicates for infinite loop: [last, ...slides, first]
  const displaySlides = slides.length > 0
    ? [slides[slides.length - 1], ...slides, slides[0]]
    : [];
  const totalSlides = slides.length;

  // Auto-rotate carousel
  useEffect(() => {
    if (isHovering || isUserInteracting || totalSlides === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const displayLength = totalSlides + 2;
        if (prev >= displayLength - 1) return 2;
        if (prev <= 0) return totalSlides - 1;
        return prev + 1;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [isHovering, isUserInteracting, totalSlides]);

  // Handle circular transitions (jump back to real slide AFTER transition ends)
  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    // Ignore bubbled transitionend events from nested elements (buttons, images, etc.
    // have their own hover/active transitions). Only react to the track's own transform transition.
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (totalSlides === 0) return;
    const displayLength = totalSlides + 2;
    if (currentSlide >= displayLength - 1) {
      // Aplicamos duration 0 directamente en el DOM y forzamos un reflow
      // ANTES de cambiar currentSlide. Si esto se hiciera en el mismo
      // commit de React (solo con setIsJumping + setCurrentSlide), algunos
      // navegadores no alcanzan a "congelar" la transición a tiempo y
      // animan brevemente el salto, mostrando de refilón el slide anterior
      // (el de "info", al estar justo antes del clon) antes de asentarse
      // en el slide real.
      if (trackRef.current) {
        trackRef.current.style.transitionDuration = "0ms";
        void trackRef.current.offsetHeight; // fuerza el reflow
      }
      setIsJumping(true);
      setCurrentSlide(1);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsJumping(false));
      });
    } else if (currentSlide <= 0) {
      if (trackRef.current) {
        trackRef.current.style.transitionDuration = "0ms";
        void trackRef.current.offsetHeight;
      }
      setIsJumping(true);
      setCurrentSlide(totalSlides);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setIsJumping(false));
      });
    }
  };

  const handleAddToCart = (product: Product) => {
    addItem(product);
  };

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePurchase = async () => {
    try {
      for (const item of items) {
        await api.purchaseProduct(item.product.id, item.quantity);
      }
      clearCart();
      setTicketId(Date.now().toString(36).toUpperCase());
      setShowSuccess(true);
      const updated = await api.getProducts("borgin");
      setProducts(updated);
      const updatedUser = await api.getMe();
      setUser(updatedUser);
    } catch (err: unknown) {
      console.error(err);
    }
  };

  const nextSlide = () => {
    setIsUserInteracting(true);
    setCurrentSlide((prev) => {
      if (prev >= displaySlides.length - 1) return prev;
      return prev + 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1500);
  };

  const prevSlide = () => {
    setIsUserInteracting(true);
    setCurrentSlide((prev) => {
      if (prev <= 0) return prev;
      return prev - 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1500);
  };

  const goToSlide = (index: number) => {
    // Map to displaySlides index (offset by 1 due to duplicate at start)
    setCurrentSlide(index + 1);
  };

  const renderProductSlide = (product: Product, keyPrefix: string | number) => (
    <div
      key={`${keyPrefix}-${product.id}`}
      className="shrink-0"
      style={{ width: `${100 / displaySlides.length}%` }}
    >
      <div className="relative rounded-2xl overflow-hidden border border-secondary/20 h-full">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-8 md:p-12 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              storefront
            </span>
            <span className="text-secondary-fixed-dim text-label-sm uppercase tracking-[0.2em]">Knockturn</span>
          </div>
          <div className="flex-1 flex items-start md:items-center">
            <div className="w-full">
              <div className="relative h-64 md:h-80 rounded-xl overflow-hidden mb-6">
                <Image
                  src={product.image_url || "/placeholder-artifact.svg"}
                  alt={product.name}
                  fill
                  className="object-cover"
                  unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/")}
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
                  onClick={() => handleAddToCart(product)}
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

  const renderInfoSlide = (keyPrefix: string | number) => (
    <div
      key={`info-${keyPrefix}`}
      className="shrink-0"
      style={{ width: `${100 / displaySlides.length}%` }}
    >
      <div className="relative rounded-2xl overflow-hidden border border-secondary/20 h-full bg-linear-to-br from-[#1c1b1b] via-[#2a2828] to-[#1c1b1b]">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-8 md:p-12 h-full flex flex-col">
          <div className="flex items-center gap-3 mb-2">
            <span className="material-symbols-outlined text-secondary text-3xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              storefront
            </span>
            <span className="text-secondary-fixed-dim text-label-sm uppercase tracking-[0.2em]">Knockturn</span>
          </div>
          <h1 className="font-display text-display-lg text-surface mb-2">
            Borgin & Burkes
          </h1>
          <p className="text-surface-dim text-body-md max-w-xl mb-8">
            Objetos de las Artes Oscuras y Reliquias Raras. Proceda bajo su propio riesgo.
          </p>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 w-full mt-auto">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
              <button
                onClick={scrollToCatalog}
                className="bg-secondary text-on-secondary rounded-full px-6 py-3 font-medium text-body-md hover:opacity-90 transition-all active:scale-95"
              >
                Ver Catálogo Oscuro
              </button>
              <button
                className="border border-secondary text-secondary rounded-full px-6 py-3 font-medium text-body-md hover:bg-secondary/10 transition-all active:scale-95"
              >
                Reliquias Malditas
              </button>
            </div>

            <div className="bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-secondary/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary-fixed text-[1.2em]" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  diamond
                </span>
                <span className="text-secondary-fixed text-body-md font-medium">
                  {user?.zerines?.toLocaleString() ?? "0"} Zerines
                </span>
              </div>
            </div>

            {getCount() > 0 && (
              <button onClick={toggleCart} className="relative flex items-center gap-2 bg-black/40 backdrop-blur-sm px-4 py-2 rounded-lg border border-secondary/20 text-secondary-fixed hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined text-[1.2em]" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                  shopping_cart
                </span>
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

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-[#1c1b1b] -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      {/* Hero Carousel */}
      <div className="max-w-7xl mx-auto mb-10">
        <div
          ref={carouselRef}
          className="relative overflow-hidden"
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          <div
            ref={trackRef}
            className="flex transition-transform ease-out"
            style={{
              // Each slide is (100/displaySlides.length)% of the track; translate by
              // (100/displaySlides.length)% of track width per index.
              transform: `translateX(-${currentSlide * (100 / Math.max(displaySlides.length, 1))}%)`,
              width: `${displaySlides.length * 100}%`,
              transitionDuration: isJumping ? "0ms" : "800ms",
            }}
            onTransitionEnd={handleTrackTransitionEnd}
          >
            {displaySlides.map((slide, i) =>
              slide.type === "product" ? renderProductSlide(slide.product, i) : renderInfoSlide(i)
            )}
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-inverse-surface/70 backdrop-blur-md text-secondary flex items-center justify-center hover:bg-inverse-surface/90 transition-colors z-10 shadow-lg border border-secondary/20"
            aria-label="Previous"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              chevron_left
            </span>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-inverse-surface/70 backdrop-blur-md text-secondary flex items-center justify-center hover:bg-inverse-surface/90 transition-colors z-10 shadow-lg border border-secondary/20"
            aria-label="Next"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              chevron_right
            </span>
          </button>

          {/* Dots - map to real slides (0 to totalSlides-1) */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
            {Array.from({ length: totalSlides }).map((_, i) => {
              const displayIndex = i + 1; // offset by 1 due to duplicate at start
              const isActive = currentSlide === displayIndex || (currentSlide === 0 && i === totalSlides - 1) || (currentSlide === displaySlides.length - 1 && i === 0);
              return (
                <button
                  key={i}
                  onClick={() => goToSlide(i)}
                  className={`w-2 h-2 rounded-full transition-all ${isActive ? "bg-secondary w-6" : "bg-gray-600 hover:bg-gray-400"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <div className="w-full sm:w-80 flex-shrink-0">
            <SearchBar
              placeholder="Buscar artefactos..."
              value={search}
              onChange={setSearch}
              size="md"
              variant="dark"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-2 sm:pb-0">
            {BORGIN_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === f
                    ? "bg-secondary text-on-secondary"
                    : "bg-inverse-surface text-surface-dim hover:bg-surface-container-highest"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Button */}
        {getCount() > 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={toggleCart}
              className="relative flex items-center gap-2 crystal-gradient text-on-primary px-4 py-2 rounded-full font-medium text-label-sm hover:opacity-90 transition-all"
            >
              <span
                className="material-symbols-outlined text-[1.1em]"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                }}
              >
                shopping_cart
              </span>
              Cesta Oscura ({getCount()})
            </button>
          </div>
        )}
      </div>

      {/* Catalog Grid */}
      <div ref={catalogRef} className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#2a2828] border border-secondary/20 rounded-3xl p-6 animate-pulse">
                <div className="h-64 bg-[#1c1b1b] rounded-2xl mb-4" />
                <div className="h-4 bg-[#1c1b1b] rounded w-1/3 mb-2" />
                <div className="h-6 bg-[#1c1b1b] rounded w-2/3 mb-2" />
                <div className="h-4 bg-[#1c1b1b] rounded w-full mb-4" />
                <div className="h-5 bg-[#1c1b1b] rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-20">
            <span
              className="material-symbols-outlined text-surface-dim text-6xl block mb-4"
              style={{
                fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
              }}
            >
              storefront
            </span>
            <p className="text-surface-dim text-body-md">
              No hay artefactos que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className="group cursor-pointer hover:-translate-y-2 transition-all duration-300 bg-[#2a2828] border border-secondary/20 rounded-3xl p-6"
              >
                <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
                  <Image
                    src={product.image_url || "/placeholder-artifact.svg"}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/")}
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
                    onClick={() => handleAddToCart(product)}
                    className="border border-secondary text-secondary rounded-full px-6 py-2 text-label-sm font-bold hover:bg-secondary hover:text-on-secondary-fixed transition-all active:scale-95"
                  >
                    Añadir a la Cesta
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-60" onClick={toggleCart}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-[#2a2828] rounded-l-2xl shadow-2xl flex flex-col border-l border-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-secondary/20">
              <h2 className="font-display text-headline-lg text-secondary-fixed">
                Cesta Oscura
              </h2>
              <button
                onClick={toggleCart}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-inverse-surface text-surface-dim transition-colors"
              >
                <span
                  className="material-symbols-outlined text-[1.2em]"
                  style={{
                    fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                  }}
                >
                  close
                </span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {items.length === 0 ? (
                <div className="text-center py-12">
                  <span
                    className="material-symbols-outlined text-surface-dim text-5xl block mb-3"
                    style={{
                      fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                    }}
                  >
                    shopping_basket
                  </span>
                  <p className="text-surface-dim text-body-md">
                    Tu cesta esta vacia
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-4 p-4 bg-[#1c1b1b] rounded-xl border border-secondary/10"
                  >
                    <Image
                      src={item.product.image_url || "/placeholder-borgin.jpg"}
                      alt={item.product.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-body-md font-medium text-surface truncate">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <ZerineDisplay
                          amount={item.product.price}
                          iconStyle="icon"
                          variant="price"
                          size="sm"
                        />
                        <span className="text-surface-dim text-label-sm">
                          x{item.quantity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="p-2 rounded-full hover:bg-error-container text-surface-dim hover:text-error transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-[1.1em]"
                        style={{
                          fontVariationSettings:
                            '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                        }}
                      >
                        delete
                      </span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {items.length > 0 && (
              <div className="p-6 border-t border-secondary/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-surface-dim text-body-md">
                    Total
                  </span>
                  <ZerineDisplay
                    amount={getTotal()}
                    iconStyle="icon"
                    variant="price"
                    size="lg"
                  />
                </div>
                <button
                  onClick={handlePurchase}
                  className="w-full crystal-gradient text-on-primary py-3 rounded-xl font-bold text-body-md hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Comprar Ahora
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Ticket Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setShowSuccess(false)}
          />
          <div className="relative w-full max-w-md parchment-edge bg-surface border-2 border-dashed border-secondary/40 rounded-2xl p-8 text-center shadow-2xl">
            {/* Punch holes */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-[#1c1b1b] border-4 border-surface" />

            <span
              className="material-symbols-outlined text-success text-5xl block mb-4"
              style={{
                fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24',
              }}
            >
              verified
            </span>
            <h3 className="font-display text-headline-lg text-primary mb-2">
              Compra Realizada
            </h3>
            <p className="text-on-surface-variant text-body-md mb-6">
              Tu pedido ha sido procesado exitosamente en la Camara del Tesoro.
            </p>
            <div className="bg-surface-container rounded-xl p-4 mb-6 text-left space-y-2">
              <div className="flex justify-between text-label-sm">
                <span className="text-on-surface-variant uppercase tracking-wider">
                  Transaccion
                </span>
                <span className="text-on-surface font-mono">
                  #B&B-{ticketId}
                </span>
              </div>
              <div className="flex justify-between text-label-sm">
                <span className="text-on-surface-variant uppercase tracking-wider">
                  Fecha
                </span>
                <span className="text-on-surface">
                  {new Date().toLocaleDateString("es-ES")}
                </span>
              </div>
              <div className="flex justify-between text-label-sm">
                <span className="text-on-surface-variant uppercase tracking-wider">
                  Estado
                </span>
                <span className="text-success font-bold">Completado</span>
              </div>
            </div>
            <button
              onClick={() => setShowSuccess(false)}
              className="bg-primary text-on-primary px-6 py-2 rounded-full font-medium text-body-md hover:opacity-90 transition-all"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
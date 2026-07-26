"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { api, Product } from "@/lib/api";
import { useCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import SearchBar from "@/components/ui/SearchBar";

const FILTERS = ["Todos", "Hechizos", "Historia", "Botanica", "DCAO", "Zoologia", "Pociones"];

type SlideType = { type: "product"; product: Product } | { type: "info" };

export default function FlourishBlottsPage() {
  const { setUser } = useAuthStore();
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } =
    useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [popularProducts, setPopularProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1); // Start at 1 (real first slide with duplicates)
  const [isHovering, setIsHovering] = useState(false);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Compute display slides with duplicates for infinite loop: [last, ...slides, first]
  const displaySlides = slides.length > 0
    ? [slides[slides.length - 1], ...slides, slides[0]]
    : [];
  const totalSlides = slides.length;

  // Load products
  useEffect(() => {
    Promise.all([
      api.getProducts("flourish"),
      api.getPopularProducts("flourish", 5),
    ]).then(([allProducts, popular]) => {
      setProducts(allProducts);
      setPopularProducts(popular);
      // Carousel: 3 random featured products + 1 info slide
      const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
      const featured = shuffled.slice(0, 3);
      const newSlides: SlideType[] = featured.map((p) => ({ type: "product", product: p }));
      newSlides.push({ type: "info" });
      setSlides(newSlides);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const nextSlide = () => {
    setIsUserInteracting(true);
    setCurrentSlide((prev) => {
      // Don't go beyond the trailing duplicate; onTransitionEnd handles the wrap.
      if (prev >= displaySlides.length - 1) return prev;
      return prev + 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1000);
  };

  const prevSlide = () => {
    setIsUserInteracting(true);
    setCurrentSlide((prev) => {
      // Don't go below the leading duplicate; onTransitionEnd handles the wrap.
      if (prev <= 0) return prev;
      return prev - 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1000);
  };

  const goToSlide = (index: number) => {
    // Map to displaySlides index (offset by 1 due to duplicate at start)
    setCurrentSlide(index + 1);
  };

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  };

  const handleAddToCart = (product: Product) => {
    addItem(product);
    showToast(`${product.name} añadido al caldero 💎`);
  };

  const handlePurchase = async () => {
    setSubmitting(true);
    try {
      for (const item of items) {
        await api.purchaseProduct(item.product.id, item.quantity);
      }
      clearCart();
      toggleCart();
      setShowSuccess(true);
      // Refresh products to show updated stock/sales
      const [updatedProducts, updatedPopular] = await Promise.all([
        api.getProducts("flourish"),
        api.getPopularProducts("flourish", 5),
      ]);
      setProducts(updatedProducts);
      setPopularProducts(updatedPopular);
      // Refresh user balance
      const updatedUser = await api.getMe();
      setUser(updatedUser);
    } catch (err: unknown) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // Auto-rotate carousel
  useEffect(() => {
    if (isHovering || isUserInteracting || totalSlides === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const displayLength = totalSlides + 2;
        // If we're parked on a duplicate (waiting for onTransitionEnd to snap back),
        // advance relative to the equivalent real slide so we keep moving forward.
        if (prev >= displayLength - 1) return 2; // was on trailing clone of slide 0 -> go to slide 1 (index 2)
        if (prev <= 0) return totalSlides - 1; // was on leading clone of last slide -> go back one real slide
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
      // Force duration 0 directly on the DOM and trigger a reflow BEFORE
      // changing currentSlide. Otherwise some browsers don't "freeze" the
      // transition in time and briefly animate the jump, showing a peek of
      // the preceding slide (the info one) before settling on the real one.
      if (trackRef.current) {
        trackRef.current.style.transitionDuration = "0ms";
        void trackRef.current.offsetHeight; // force reflow
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

  const filtered = products.filter((p) => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = activeFilter === "Todos" || p.category === activeFilter;
    return matchesSearch && matchesFilter;
  });

const renderProductSlide = (product: Product, keyPrefix: string | number) => (
    <div
      key={`${keyPrefix}-${product.id}`}
      className="shrink-0"
      style={{ width: `${100 / displaySlides.length}%` }}
    >
      <div className="relative rounded-3xl overflow-hidden glass-card border border-lilac-200 h-full">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#8e44ad]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 p-6 md:p-10 h-full flex flex-col">
          <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-6">
            <Image
              src={product.image_url || "/placeholder-book.svg"}
              alt={product.name}
              fill
              className="object-cover"
              unoptimized={
                !!product.image_url &&
                (product.image_url.startsWith("http://localhost:8000/uploads/") ||
                  product.image_url.startsWith("/placeholder-"))
              }
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
            <ZerineDisplay amount={product.price} iconStyle="emoji" variant="price" size="lg" />
            <button
              onClick={() => handleAddToCart(product)}
              className="border border-primary text-primary rounded-full px-6 py-3 text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95"
            >
              Añadir al Caldero
            </button>
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
          <h1 className="font-display text-display-lg text-primary mb-4 leading-tight">
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
              onClick={() => catalogRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="bg-primary text-on-primary rounded-full px-8 py-3 font-semibold text-body-md hover:opacity-90 transition-all active:scale-95 shadow-md"
            >
              Explorar Catálogo
          </button>
            {getCount() > 0 && (
              <button
                onClick={toggleCart}
                className="relative flex items-center gap-2 bg-white/70 backdrop-blur-sm px-5 py-3 rounded-full border border-lilac-300 text-[#8e44ad] hover:bg-white transition-colors font-medium"
              >
                <span
                  className="material-symbols-outlined"
                  style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
                >
                  shopping_cart
              </span>
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

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-surface parchment-bg -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-100 animate-slide-down">
          <div
            className={`px-6 py-3 rounded-full shadow-xl text-label-sm font-medium flex items-center gap-2 ${
              toast.type === "success"
                ? "bg-success text-on-success"
                : "bg-error text-on-error"
            }`}
          >
            <span
              className="material-symbols-outlined"
              style={{
                fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24',
              }}
            >
              {toast.type === "success" ? "check_circle" : "error"}
            </span>
            {toast.message}
          </div>
        </div>
      )}

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
              // Each slide is (100/displaySlides.length)% of the track, so to advance
              // by one slide per index we need to translate by (100/displaySlides.length)%
              // of the track's own width.
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
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 backdrop-blur-md text-[#8e44ad] flex items-center justify-center hover:bg-white/90 transition-colors z-10 shadow-lg"
            aria-label="Previous"
          >
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              chevron_left
            </span>
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/70 backdrop-blur-md text-[#8e44ad] flex items-center justify-center hover:bg-white/90 transition-colors z-10 shadow-lg"
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
                  className={`w-2 h-2 rounded-full transition-all ${isActive ? "bg-[#8e44ad] w-6" : "bg-gray-300 hover:bg-gray-400"}`}
                  aria-label={`Slide ${i + 1}`}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-full sm:w-80">
            <SearchBar
              placeholder="Buscar libros..."
              value={search}
              onChange={setSearch}
              size="md"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                  activeFilter === f
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
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
              className="relative flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-medium text-label-sm hover:opacity-90 transition-all"
            >
              <span
                className="material-symbols-outlined text-[1.1em]"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                }}
              >
                shopping_cart
              </span>
              Mi Caldero ({getCount()})
            </button>
          </div>
        )}
      </div>

      {/* Catalog Grid */}
      <div ref={catalogRef} className="max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-card rounded-3xl p-6 animate-pulse">
                <div className="h-64 bg-surface-container-high rounded-2xl mb-4" />
                <div className="h-4 bg-surface-container-high rounded w-1/3 mb-2" />
                <div className="h-6 bg-surface-container-high rounded w-2/3 mb-2" />
                <div className="h-4 bg-surface-container-high rounded w-full mb-4" />
                <div className="h-5 bg-surface-container-high rounded w-1/4" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <span
              className="material-symbols-outlined text-on-surface-variant text-6xl block mb-4"
              style={{
                fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
              }}
            >
              menu_book
            </span>
            <p className="text-on-surface-variant text-body-md">
              No se encontraron libros con esos criterios.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filtered.map((product) => (
              <div
                key={product.id}
                className="glass-card rounded-3xl p-6 group cursor-pointer hover:-translate-y-2 transition-all duration-300"
              >
                <div className="relative h-64 rounded-2xl overflow-hidden mb-4">
                  <Image
                    src={product.image_url || "/placeholder-book.jpg"}
                    alt={product.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-500"
                    unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/")}
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
                  <ZerineDisplay amount={product.price} iconStyle="emoji" variant="price" />
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="border border-primary text-primary rounded-full px-6 py-2 text-label-sm font-bold hover:bg-primary hover:text-on-primary transition-all active:scale-95"
                  >
                    Añadir al Caldero
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Popular Recommendations - Grid instead of horizontal scroll */}
        <div className="max-w-7xl mx-auto mb-10 mt-10">
          <h2 className="font-display text-headline-lg text-on-surface mb-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#8e44ad]" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              local_fire_department
            </span>
            Popular entre Prefectos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {popularProducts.map((product) => (
              <div key={product.id} className="glass-card rounded-2xl p-4 border-l-4 border-l-[#8e44ad] hover:-translate-y-1 transition-transform">
                <div className="relative h-32 rounded-xl overflow-hidden mb-3">
                  <Image
                    src={product.image_url || "/placeholder-book.jpg"}
                    alt={product.name}
                    fill
                    className="object-cover"
                    unoptimized={product.image_url?.startsWith("http://localhost:8000/uploads/")}
                  />
                </div>
                <h4 className="font-display text-body-md text-on-surface mb-1 line-clamp-1">{product.name}</h4>
                <p className="text-label-sm text-on-surface-variant line-clamp-1 mb-2">{product.description}</p>
                <div className="flex items-center justify-between">
                  <ZerineDisplay amount={product.price} iconStyle="emoji" variant="price" size="sm" />
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="border border-[#8e44ad] text-[#8e44ad] rounded-full px-4 py-1.5 text-label-sm font-bold hover:bg-[#8e44ad] hover:text-on-primary transition-all active:scale-95"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cart Sidebar */}
      {isOpen && (
        <div className="fixed inset-0 z-60" onClick={toggleCart}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div
            className="absolute right-0 top-0 h-full w-full max-w-md bg-surface-container-lowest rounded-l-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
              <h2 className="font-display text-headline-lg text-primary">
                Mi Caldero
              </h2>
              <button
                onClick={toggleCart}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
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
                    className="material-symbols-outlined text-on-surface-variant text-5xl block mb-3"
                    style={{
                      fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                    }}
                  >
                    shopping_basket
                  </span>
                  <p className="text-on-surface-variant text-body-md">
                    Tu caldero esta vacio
                  </p>
                </div>
              ) : (
                items.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center gap-4 p-4 bg-surface-container rounded-xl"
                  >
                    <Image
                      src={item.product.image_url || "/placeholder-book.jpg"}
                      alt={item.product.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg object-cover shrink-0"
                      unoptimized={item.product.image_url?.startsWith("http://localhost:8000/uploads/")}
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-body-md font-medium text-on-surface truncate">
                        {item.product.name}
                      </h4>
                      <div className="flex items-center gap-2 mt-1">
                        <ZerineDisplay
                          amount={item.product.price}
                          iconStyle="emoji"
                          variant="price"
                          size="sm"
                        />
                        <span className="text-on-surface-variant text-label-sm">
                          x{item.quantity}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(item.product.id)}
                      className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
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

            {items.length > 0 && (
              <div className="p-6 border-t border-outline-variant/20 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-on-surface-variant text-body-md">
                    Total
                  </span>
                  <ZerineDisplay
                    amount={getTotal()}
                    iconStyle="emoji"
                    variant="price"
                    size="lg"
                  />
                </div>
                <button
                  onClick={handlePurchase}
                  disabled={submitting}
                  className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-body-md hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? "Procesando..." : "Comprar en Flourish & Blotts"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" onClick={() => setShowSuccess(false)} />
          <div className="relative w-full max-w-md bg-surface rounded-3xl p-8 text-center shadow-2xl">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-success text-5xl" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
                check_circle
              </span>
            </div>
            <h3 className="font-display text-headline-lg text-primary mb-2">Compra Realizada</h3>
            <p className="text-on-surface-variant text-body-md mb-6">
              Tu pedido ha sido procesado exitosamente. Los libros llegarán por lechuza en breve.
            </p>
            <button
              onClick={() => setShowSuccess(false)}
              className="bg-primary text-on-primary px-6 py-3 rounded-full font-medium text-body-md hover:opacity-90 transition-all"
            >
              Volver al Catálogo
            </button>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes slide-down {
          from {
            opacity: 0;
            transform: translate(-50%, -10px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slide-down {
          animation: slide-down 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { api, Product, UserProduct } from "@/lib/api";
import { useCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import { SearchBar, MaterialIcon, TabGroup } from "@/components/ui";
import { BookCard, HeroCarousel, CartSidebar, SuccessModal } from "@/components/domain/FlourishBlotts";

const FILTERS = ["Todos", "Hechizos", "Historia", "Botanica", "DCAO", "Zoologia", "Pociones"];

type SlideType = { type: "product"; product: Product } | { type: "info" };

export default function FlourishBlottsPage() {
  const { setUser } = useAuthStore();
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [myPurchases, setMyPurchases] = useState<UserProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");
  const trackRef = useRef<HTMLDivElement>(null);

  // Compute display slides with duplicates for infinite loop
  const displaySlides = slides.length > 0
    ? [slides[slides.length - 1], ...slides, slides[0]]
    : [];
  const totalSlides = slides.length;

  // Load products
  useEffect(() => {
    Promise.all([
      api.getProducts("flourish"),
      api.getMyPurchases(),
    ]).then(([allProducts, purchases]) => {
      setProducts(allProducts);
      setMyPurchases(purchases);
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
      if (prev >= displaySlides.length - 1) return prev;
      return prev + 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1000);
  };

  const prevSlide = () => {
    setIsUserInteracting(true);
    setCurrentSlide((prev) => {
      if (prev <= 0) return prev;
      return prev - 1;
    });
    setTimeout(() => setIsUserInteracting(false), 1000);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index + 1);
  };

  const handleAddToCart = (product: Product) => {
    addItem(product);
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
      const [updatedProducts, updatedPurchases] = await Promise.all([
        api.getProducts("flourish"),
        api.getMyPurchases(),
      ]);
      setProducts(updatedProducts);
      setMyPurchases(updatedPurchases);
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
    if (isUserInteracting || totalSlides === 0) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const displayLength = totalSlides + 2;
        if (prev >= displayLength - 1) return 2;
        if (prev <= 0) return totalSlides - 1;
        return prev + 1;
      });
    }, 6000);
    return () => clearInterval(interval);
  }, [isUserInteracting, totalSlides]);

  // Handle circular transitions
  const handleTrackTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || e.propertyName !== "transform") return;
    if (totalSlides === 0) return;
    const displayLength = totalSlides + 2;
    if (currentSlide >= displayLength - 1) {
      if (trackRef.current) {
        trackRef.current.style.transitionDuration = "0ms";
        void trackRef.current.offsetHeight;
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

  return (
    <div className="min-h-content bg-surface parchment-bg -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      {/* Hero Carousel */}
      <div className="max-w-7xl mx-auto mb-10">
        <HeroCarousel
          displaySlides={displaySlides}
          totalSlides={totalSlides}
          currentSlide={currentSlide}
          isJumping={isJumping}
          trackRef={trackRef}
          onNextSlide={nextSlide}
          onPrevSlide={prevSlide}
          onGoToSlide={goToSlide}
          onTrackTransitionEnd={handleTrackTransitionEnd}
          getCount={getCount}
          onToggleCart={toggleCart}
          onCatalogScroll={() => {}}
        />
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <TabGroup
          tabs={[
            { id: "catalog", label: "Catalogo", icon: "menu_book" },
            { id: "library", label: "Mi Biblioteca", icon: "local_library" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="light"
        />
      </div>

      {activeTab === "catalog" && (
        <>
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
              <div className="flex gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-2 sm:pb-0 w-full min-w-0">
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

            {getCount() > 0 && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={toggleCart}
                  className="relative flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-full font-medium text-label-sm hover:opacity-90 transition-all"
                >
                  <MaterialIcon name="shopping_cart" className="text-[1.1em]" />
                  Mi Caldero ({getCount()})
                </button>
              </div>
            )}
          </div>

          {/* Catalog Grid */}
          <div className="max-w-7xl mx-auto">
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
                <MaterialIcon
                  name="menu_book"
                  className="text-on-surface-variant text-6xl block mb-4"
                />
                <p className="text-on-surface-variant text-body-md">
                  No se encontraron libros con esos criterios.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filtered.map((product) => (
                  <BookCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== MI BIBLIOTECA ===== */}
      {activeTab === "library" && (
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="glass-card rounded-3xl p-6 animate-pulse">
                  <div className="h-48 bg-surface-container-high rounded-2xl mb-4" />
                  <div className="h-4 bg-surface-container-high rounded w-2/3 mb-2" />
                  <div className="h-3 bg-surface-container-high rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : myPurchases.length === 0 ? (
            <div className="text-center py-20">
              <MaterialIcon
                name="local_library"
                className="text-on-surface-variant text-6xl block mb-4"
              />
              <p className="text-on-surface-variant text-body-md mb-2">
                Tu biblioteca esta vacia.
              </p>
              <p className="text-on-surface-variant text-body-sm mb-6">
                Explora el catalogo y adquiere tu primer libro.
              </p>
              <button
                onClick={() => setActiveTab("catalog")}
                className="px-6 py-3 rounded-full bg-primary text-on-primary font-medium text-label-sm hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                <MaterialIcon name="menu_book" className="text-[1.1em]" />
                Ver Catalogo
              </button>
            </div>
          ) : (
            <>
              <p className="text-on-surface-variant text-body-sm mb-6">
                {myPurchases.length} {myPurchases.length === 1 ? "libro comprado" : "libros comprados"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {myPurchases.map((up) => (
                  <div
                    key={up.id}
                    className="glass-card rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative h-48 overflow-hidden">
                      {up.product?.image_url ? (
                        <Image
                          src={up.product.image_url}
                          alt={up.product?.name ?? "Libro"}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized={up.product.image_url.startsWith("http://localhost:8000/uploads/")}
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/5 flex items-center justify-center">
                          <MaterialIcon name="menu_book" className="text-5xl text-primary/30" />
                        </div>
                      )}
                      <span className="absolute top-3 right-3 bg-success/90 text-on-success backdrop-blur-sm px-3 py-1 rounded-full text-label-sm font-bold flex items-center gap-1">
                        <MaterialIcon name="check" className="text-[1em]" filled />
                        Comprado
                      </span>
                    </div>
                    <div className="p-5">
                      {up.product?.category && (
                        <span className="text-label-sm text-primary font-medium uppercase tracking-wider">
                          {up.product.category}
                        </span>
                      )}
                      <h3 className="font-display text-title-md text-on-surface mt-1 mb-1 line-clamp-2">
                        {up.product?.name ?? "Libro sin nombre"}
                      </h3>
                      {up.product?.description && (
                        <p className="text-body-sm text-on-surface-variant line-clamp-2 mb-3">
                          {up.product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                        <span>
                          {up.quantity > 1 ? `x${up.quantity} ` : ""}
                          <span className="font-bold text-secondary">
                            💎 {((up.product?.price ?? 0) * up.quantity).toLocaleString()}
                          </span>
                        </span>
                        <span>
                          {new Date(up.purchased_at).toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isOpen}
        onClose={toggleCart}
        items={items}
        getTotal={getTotal}
        onRemoveItem={removeItem}
        onPurchase={handlePurchase}
        submitting={submitting}
      />

      {/* Success Modal */}
      <SuccessModal isOpen={showSuccess} onClose={() => setShowSuccess(false)} />

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
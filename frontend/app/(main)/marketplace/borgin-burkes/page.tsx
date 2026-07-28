"use client";

import { useEffect, useState, useRef } from "react";
import { api, Product } from "@/lib/api";
import { useCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import { SearchBar, MaterialIcon } from "@/components/ui";
import { ArtifactCard, HeroCarousel, CartSidebar, SuccessTicket } from "@/components/domain/BorginBurkes";

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
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } = useCartStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const catalogRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

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
        const shuffled = [...allProducts].sort(() => 0.5 - Math.random());
        const featured = shuffled.slice(0, 3);
        const newSlides: SlideType[] = featured.map((p) => ({ type: "product", product: p }));
        newSlides.push({ type: "info" });
        setSlides(newSlides);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const displaySlides = slides.length > 0
    ? [slides[slides.length - 1], ...slides, slides[0]]
    : [];
  const totalSlides = slides.length;

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
    setCurrentSlide(index + 1);
  };

  return (
    <div className="min-h-content bg-[#1c1b1b] -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      {/* Hero Carousel */}
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
        userZerines={user?.zerines}
        getCount={getCount}
        onToggleCart={toggleCart}
        onScrollToCatalog={scrollToCatalog}
        onAddToCart={handleAddToCart}
      />

      {/* Search & Filters */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
          <div className="w-full sm:w-80 shrink-0">
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

        {getCount() > 0 && (
          <div className="flex justify-end mt-4">
            <button
              onClick={toggleCart}
              className="relative flex items-center gap-2 crystal-gradient text-on-primary px-4 py-2 rounded-full font-medium text-label-sm hover:opacity-90 transition-all"
            >
              <MaterialIcon name="shopping_cart" className="text-[1.1em]" />
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
            <MaterialIcon
              name="storefront"
              className="text-surface-dim text-6xl block mb-4"
            />
            <p className="text-surface-dim text-body-md">
              No hay artefactos que coincidan con tu búsqueda.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <ArtifactCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      <CartSidebar
        isOpen={isOpen}
        onClose={toggleCart}
        items={items}
        getTotal={getTotal}
        onRemoveItem={removeItem}
        onPurchase={handlePurchase}
      />

      {/* Success Ticket Modal */}
      <SuccessTicket
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        ticketId={ticketId}
      />
    </div>
  );
}
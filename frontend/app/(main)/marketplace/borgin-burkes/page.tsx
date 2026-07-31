"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { api, Product, EnumValue } from "@/lib/api";
import { useCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import { SearchBar, MaterialIcon, TabGroup, ListFooter, ErrorBoundary } from "@/components/ui";
import { ArtifactCard, HeroCarousel, CartSidebar, SuccessTicket } from "@/components/domain/BorginBurkes";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebounce } from "@/hooks/useDebounce";
import { toastError, toastSuccess } from "@/lib/toastStore";

type SlideType = { type: "product"; product: Product } | { type: "info" };

export default function BorginBurkesPage() {
  const { user, setUser } = useAuthStore();
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } = useCartStore();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [ticketId, setTicketId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");
  const [borginCategories, setBorginCategories] = useState<EnumValue[]>([]);
  const catalogRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  const {
    items: allShopItems,
    hasMore: productsHasMore,
    loading: productsLoading,
    loadingMore: productsLoadingMore,
    totalCount: productsTotal,
    loadMore: loadMoreProducts,
    refresh: refreshProducts,
  } = usePaginatedList({
    fetcher: (p) =>
      api.getProducts("borgin", p, activeFilter === "Todos" ? undefined : activeFilter),
    pageSize: 12,
    enabled: true,
    queryKey: ["shop-products", "borgin"],
    resetKey: activeFilter,
  });

  const {
    items: allPurchases,
    hasMore: purchasesHasMore,
    loading: purchasesLoading,
    loadingMore: purchasesLoadingMore,
    totalCount: purchasesTotal,
    loadMore: loadMorePurchases,
    refresh: refreshPurchases,
  } = usePaginatedList({
    fetcher: (p) => api.getMyPurchases(p),
    pageSize: 9,
    enabled: true,
    queryKey: ["my-purchases"],
  });

  const BORGIN_FILTERS = ["Todos", ...borginCategories.map((c) => c.label)];

  const filteredProducts = allShopItems.filter(
    (p) =>
      !debouncedSearch ||
      p.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      p.description.toLowerCase().includes(debouncedSearch.toLowerCase()),
  );

  const visibleProducts = filteredProducts;
  const visiblePurchases = allPurchases;

  // Compute display slides with duplicates for infinite loop
  const displaySlides = slides.length > 0
    ? [slides[slides.length - 1], ...slides, slides[0]]
    : [];
  const totalSlides = slides.length;

  const slidesSetRef = useRef(false);

  useEffect(() => {
    if (allShopItems.length > 0 && !slidesSetRef.current) {
      slidesSetRef.current = true;
      const shuffled = [...allShopItems].sort(() => 0.5 - Math.random());
      const featured = shuffled.slice(0, 3);
      const newSlides: SlideType[] = featured.map((p) => ({ type: "product", product: p }));
      newSlides.unshift({ type: "info" });
      setSlides(newSlides);
    }
  }, [allShopItems]);

  useEffect(() => {
    api.getEnumCategoryByCode("borgin_category").then((cat) => {
      if (cat) setBorginCategories(cat.values);
    }).catch(() => {});
  }, []);

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

  const handleAddToCart = (product: Product) => {
    addItem(product);
    toastSuccess("Añadido a la Cesta Oscura", `${product.name} está en tu cesta`);
  };

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePurchase = async () => {
    setSubmitting(true);
    try {
      const result = await api.batchPurchase(
        items.map((i) => ({ product_id: i.product.id, quantity: i.quantity }))
      );
      clearCart();
      toggleCart();
      setTicketId(Date.now().toString(36).toUpperCase());
      setShowSuccess(true);
      await Promise.all([
        refreshPurchases(),
        refreshProducts(),
      ]);
      // Refresh user balance
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      toastSuccess(
        "Compra completada",
        `${result.purchased.length} artefacto(s) · ${result.total_spent.toLocaleString()} Zerines`
      );
    } catch (err: unknown) {
      toastError("No se pudo completar la compra", err);
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="min-h-content bg-[#1c1b1b] -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
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
          userZerines={user?.zerines}
          getCount={getCount}
          onToggleCart={toggleCart}
          onScrollToCatalog={scrollToCatalog}
          onAddToCart={handleAddToCart}
        />
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto mb-8">
        <TabGroup
          tabs={[
            { id: "catalog", label: "Catálogo", icon: "inventory_2" },
            { id: "library", label: "Mis Artículos", icon: "auto_awesome" },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="dark"
        />
      </div>

      {activeTab === "catalog" && (
        <>
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
              <div className="flex gap-2 overflow-x-auto no-scrollbar flex-nowrap pb-2 sm:pb-0 w-full min-w-0">
                {BORGIN_FILTERS.map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                      activeFilter === f
                        ? "bg-secondary text-on-secondary"
                        : "bg-inverse-surface text-surface-dim hover:bg-surface-container-highest hover:text-secondary"
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
            <ErrorBoundary>
            {productsLoading ? (
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
              <>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibleProducts.map((product) => (
                  <ArtifactCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                  />
                ))}
              </div>
              <ListFooter
                hasMore={productsHasMore}
                loading={productsLoadingMore}
                pageSize={12}
                loaded={allShopItems.length}
                total={productsTotal}
                onLoadMore={loadMoreProducts}
              />
              </>
            )}
            </ErrorBoundary>
          </div>
        </>
      )}

      {/* ===== MIS ArtículoS ===== */}
      {activeTab === "library" && (
        <div className="max-w-7xl mx-auto">
          {purchasesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-[#2a2828] border border-secondary/20 rounded-3xl p-6 animate-pulse">
                  <div className="h-48 bg-[#1c1b1b] rounded-2xl mb-4" />
                  <div className="h-4 bg-[#1c1b1b] rounded w-2/3 mb-2" />
                  <div className="h-3 bg-[#1c1b1b] rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : allPurchases.length === 0 ? (
            <div className="text-center py-20">
              <MaterialIcon
                name="collections"
                className="text-surface-dim text-6xl block mb-4"
              />
              <p className="text-surface-dim text-body-md mb-2">
                Tu coleccion esta vacia.
              </p>
              <p className="text-surface-dim text-body-sm mb-6">
                Explora el catálogo y adquiere tu primer artefacto.
              </p>
              <button
                onClick={() => setActiveTab("catalog")}
                className="px-6 py-3 rounded-full crystal-gradient text-on-primary font-medium text-label-sm hover:opacity-90 transition-all inline-flex items-center gap-2"
              >
                <MaterialIcon name="inventory_2" className="text-[1.1em]" />
                Ver Catálogo
              </button>
            </div>
          ) : (
            <>
              <p className="text-surface-dim text-body-sm mb-6">
                {allPurchases.length} {allPurchases.length === 1 ? "artículo comprado" : "artículos comprados"}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visiblePurchases.map((up) => (
                  <div
                    key={up.id}
                    className="bg-[#2a2828] border border-secondary/20 rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300"
                  >
                    <div className="relative h-48 overflow-hidden">
                      {up.product?.image_url ? (
                        <Image
                          src={up.product.image_url}
                          alt={up.product?.name ?? "Artefacto"}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-500"
                          unoptimized={up.product.image_url.startsWith("http://localhost:8000/uploads/")}
                        />
                      ) : (
                        <div className="w-full h-full bg-[#1c1b1b] flex items-center justify-center">
                          <MaterialIcon name="inventory_2" className="text-5xl text-secondary/30" />
                        </div>
                      )}
                      <span className="absolute top-3 right-3 bg-green-600/90 text-white backdrop-blur-sm px-3 py-1 rounded-full text-label-sm font-bold flex items-center gap-1">
                        <MaterialIcon name="check" className="text-[1em]" filled />
                        Comprado
                      </span>
                    </div>
                    <div className="p-5">
                      {up.product?.category && (
                        <span className="text-label-sm text-secondary font-medium uppercase tracking-wider">
                          {up.product.category}
                        </span>
                      )}
                      <h3 className="font-display text-title-md text-surface mt-1 mb-1 line-clamp-2">
                        {up.product?.name ?? "Artefacto sin nombre"}
                      </h3>
                      {up.product?.description && (
                        <p className="text-body-sm text-surface-dim line-clamp-2 mb-3">
                          {up.product.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between text-label-sm text-surface-dim">
                        <span>
                          {up.quantity > 1 ? `x${up.quantity} ` : ""}
                          <span className="font-bold text-secondary">
                            <MaterialIcon name="diamond" className="text-[1em]" filled /> {((up.product?.price ?? 0) * up.quantity).toLocaleString()}
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
              <ListFooter
                hasMore={purchasesHasMore}
                loading={purchasesLoadingMore}
                pageSize={9}
                loaded={allPurchases.length}
                total={purchasesTotal}
                onLoadMore={loadMorePurchases}
              />
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
        userZerines={user?.zerines ?? 0}
        submitting={submitting}
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
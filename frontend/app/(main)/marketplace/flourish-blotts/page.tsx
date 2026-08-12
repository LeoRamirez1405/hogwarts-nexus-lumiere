"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Image from "next/image";
import { isStoredUpload } from "@/lib/media";
import { api, Product, EnumValue } from "@/lib/api";
import { useFlourishCartStore } from "@/lib/cartStore";
import { useAuthStore } from "@/lib/authStore";
import { SearchBar, MaterialIcon, TabGroup, ListFooter, ErrorBoundary, Skeleton, DetailModal, PurchaseSuccessModal } from "@/components/ui";
import { BookCard, HeroCarousel, CartSidebar, ProductDetailContent } from "@/components/domain/FlourishBlotts";
import { SpecificationModal } from "@/components/domain/SpecificationModal";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebounce } from "@/hooks/useDebounce";
import { toastError, toastSuccess } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

type SlideType = { type: "product"; product: Product } | { type: "info" };

export default function FlourishBlottsPage() {
  const { user, setUser } = useAuthStore();
  const { items, addItem, removeItem, clearCart, toggleCart, isOpen, getTotal, getCount } = useFlourishCartStore();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activeFilter, setActiveFilter] = useState("Todos");
  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [slides, setSlides] = useState<SlideType[]>([]);
  const [currentSlide, setCurrentSlide] = useState(1);
  const [isJumping, setIsJumping] = useState(false);
  const [isUserInteracting, setIsUserInteracting] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");
  const [bookCategories, setBookCategories] = useState<EnumValue[]>([]);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [specProduct, setSpecProduct] = useState<Product | null>(null);

  const dynamicFilters = ["Todos", ...bookCategories.map((c) => c.label)];
  const trackRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const {
    items: allShopItems,
    hasMore: booksHasMore,
    loading: booksLoading,
    loadingMore: booksLoadingMore,
    totalCount: booksTotal,
    loadMore: loadMoreBooks,
    refresh: refreshBooks,
  } = usePaginatedList({
    fetcher: (p) =>
      api.getProducts(
        "flourish",
        p,
        activeFilter === "Todos" ? undefined : activeFilter,
        debouncedSearch || undefined
      ),
    pageSize: 12,
    enabled: true,
    queryKey: ["shop-products", "flourish"],
    resetKey: [activeFilter, debouncedSearch],
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
    api.getEnumCategoryByCode("book_category")
      .then((cat) => {
        if (cat) setBookCategories(cat.values);
      })
      .catch((e) => toastError("No se pudieron cargar las categorías", e));
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
    setSpecProduct(product);
  };

  const handleSpecConfirm = (specification: string) => {
    if (!specProduct) return;
    addItem(specProduct, specification);
    setSpecProduct(null);
    toastSuccess("Añadido al Caldero", `${specProduct.name} está en tu caldero`);
  };

  const handleViewDetails = (product: Product) => {
    setDetailProduct(product);
  };

  const scrollToCatalog = () => {
    catalogRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePurchase = async () => {
    setSubmitting(true);
    try {
      const result = await api.batchPurchase(
        items.map((i) => ({
          product_id: i.product.id,
          quantity: i.quantity,
          specification: i.specification,
        }))
      );
      clearCart();
      toggleCart();
      setShowSuccess(true);
      await Promise.all([
        refreshPurchases(),
        refreshBooks(),
      ]);
      // Refresh user balance
      const updatedUser = await api.getMe();
      setUser(updatedUser);
      toastSuccess(
        "Compra realizada con éxito",
        `${result.purchased.length} libro(s) · ${result.total_spent.toLocaleString()} Zerines`
      );
    } catch (err: unknown) {
      toastError("No se pudo completar la compra", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefresh = useCallback(async () => {
    if (activeTab === "catalog") {
      await refreshBooks();
    } else {
      await refreshPurchases();
    }
  }, [activeTab, refreshBooks, refreshPurchases]);

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

  const visibleBooks = allShopItems;
  const visiblePurchases = allPurchases;

  return (
    <div className="min-h-content bg-surface -mx-4 md:-mx-10 -mt-6 md:-mt-8 px-4 md:px-10 py-8">
      <PullToRefresh onRefresh={handleRefresh}>
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
            onCatalogScroll={scrollToCatalog}
            onAddToCart={handleAddToCart}
          />
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto mb-8">
          <TabGroup
            tabs={[
              { id: "catalog", label: "Catálogo", icon: "menu_book" },
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
                  {dynamicFilters.map((f) => (
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
            <div ref={catalogRef} className="max-w-7xl mx-auto">
              <ErrorBoundary>
              {booksLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="product" />
                  ))}
                </div>
              ) : allShopItems.length === 0 ? (
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
                <>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {visibleBooks.map((product) => (
                    <BookCard
                      key={product.id}
                      product={product}
                      onAddToCart={handleAddToCart}
                      onViewDetails={handleViewDetails}
                    />
                  ))}
                </div>
                <ListFooter
                  hasMore={booksHasMore}
                  loading={booksLoadingMore}
                  pageSize={12}
                  loaded={allShopItems.length}
                  total={booksTotal}
                  onLoadMore={loadMoreBooks}
                />
                </>
              )}
              </ErrorBoundary>
            </div>
          </>
        )}

        {/* ===== MI BIBLIOTECA ===== */}
        {activeTab === "library" && (
          <div className="max-w-7xl mx-auto">
            <ErrorBoundary>
            {purchasesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} variant="product" />
                ))}
              </div>
            ) : allPurchases.length === 0 ? (
              <div className="text-center py-20">
                <MaterialIcon
                  name="local_library"
                  className="text-on-surface-variant text-6xl block mb-4"
                />
                <p className="text-on-surface-variant text-body-md mb-2">
                  Tu biblioteca esta vacia.
                </p>
                <p className="text-on-surface-variant text-body-sm mb-6">
                  Explora el catálogo y adquiere tu primer libro.
                </p>
                <button
                  onClick={() => setActiveTab("catalog")}
                  className="px-6 py-3 rounded-full bg-primary text-on-primary font-medium text-label-sm hover:opacity-90 transition-all inline-flex items-center gap-2"
                >
                  <MaterialIcon name="menu_book" className="text-[1.1em]" />
                  Ver Catálogo
                </button>
              </div>
            ) : (
              <>
                <p className="text-on-surface-variant text-body-sm mb-6">
                  {allPurchases.length} {allPurchases.length === 1 ? "libro comprado" : "libros comprados"}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {visiblePurchases.map((up) => (
                    <div
                      key={up.id}
                      className="glass-card rounded-3xl overflow-hidden group hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                      onClick={() => up.product && handleViewDetails(up.product)}
                    >
                      <div className="relative h-48 overflow-hidden">
                        {up.product?.image_url
                          ? <Image src={up.product.image_url} alt={up.product?.name ?? "Libro"} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized={isStoredUpload(up.product.image_url)} />
                          : <div className="w-full h-full bg-primary/5 flex items-center justify-center"><MaterialIcon name="menu_book" className="text-5xl text-primary/30" /></div>
                        }
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
                        {up.specification && (
                          <div className="flex items-start gap-2 mb-3 rounded-xl bg-primary/5 border border-primary/15 px-3 py-2">
                            <MaterialIcon name="edit_note" className="text-primary shrink-0 mt-0.5" />
                            <p className="text-body-sm text-primary line-clamp-2">
                              <span className="font-semibold">Especificacion: </span>
                              {up.specification}
                            </p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-label-sm text-on-surface-variant">
                          <span>
                            {up.quantity > 1 ? `x${up.quantity} ` : ""}
                            <span className="font-bold text-secondary">
                              <MaterialIcon name="diamond" className="text-[1em]" filled inline /> {((up.product?.price ?? 0) * up.quantity).toLocaleString()}
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
            </ErrorBoundary>
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
          userZerines={user?.zerines ?? 0}
        />

        {/* Success Modal */}
        <PurchaseSuccessModal
          isOpen={showSuccess}
          onClose={() => setShowSuccess(false)}
        />

        {/* Product Detail Modal */}
        <DetailModal
          open={!!detailProduct}
          onClose={() => setDetailProduct(null)}
          title={detailProduct?.name}
          theme="light"
          size="md"
        >
          {detailProduct && (
            <ProductDetailContent
              product={detailProduct}
              onAddToCart={handleAddToCart}
            />
          )}
        </DetailModal>

        {/* Specification Modal */}
        <SpecificationModal
          open={!!specProduct}
          product={specProduct}
          onConfirm={handleSpecConfirm}
          onCancel={() => setSpecProduct(null)}
        />

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
      </PullToRefresh>
    </div>
  );
}
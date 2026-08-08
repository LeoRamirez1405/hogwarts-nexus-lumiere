"use client";

import { CartItem } from "@/lib/cartStore";
import Image from "next/image";
import { MaterialIcon, Button, ZerineDisplay, BottomSheet } from "@/components/ui";
import { getFallbackForProduct } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  getTotal: () => number;
  onRemoveItem: (productId: string, specification?: string) => void;
  onPurchase: () => Promise<void>;
  submitting: boolean;
  userZerines: number;
}

function CartContents({
  items,
  getTotal,
  onRemoveItem,
  onPurchase,
  userZerines,
  submitting,
  fallbackSrc,
}: {
  items: CartItem[];
  getTotal: () => number;
  onRemoveItem: (productId: string, specification?: string) => void;
  onPurchase: () => Promise<void>;
  userZerines: number;
  submitting: boolean;
  fallbackSrc: string;
}) {
  const total = getTotal();
  const insufficient = total > userZerines;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {items.length === 0 ? (
          <div className="text-center py-12">
            <MaterialIcon
              name="shopping_cart"
              className="text-outline-variant text-5xl mb-3 block mx-auto"
            />
            <p className="text-on-surface-variant text-body-md">Tu caldero está vacío</p>
            <p className="text-on-surface-variant text-label-sm mt-1">Añade algunos libros para empezar</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={`${item.product.id}::${item.specification ?? ""}`}
              className="flex items-center gap-4 p-4 bg-surface-container rounded-xl"
            >
              <Image
                src={item.product.image_url || fallbackSrc}
                alt={item.product.name}
                width={64}
                height={64}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
                unoptimized={item.product.image_url?.startsWith("http://localhost:8000/uploads/") || item.product.image_url?.startsWith("/fallbacks/")}
              />
              <div className="flex-1 min-w-0">
                <h4 className="text-body-md font-medium text-on-surface truncate">
                  {item.product.name}
                </h4>
                {item.specification && (
                  <p className="text-label-sm text-primary mt-0.5 truncate">
                    <MaterialIcon name="edit_note" className="text-[1em] align-[-2px]" /> {item.specification}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <ZerineDisplay
                    amount={item.product.price}
                    iconStyle="emoji"
                    variant="price"
                    size="sm"
                  />
                  <span className="text-on-surface-variant text-label-sm">x{item.quantity}</span>
                </div>
              </div>
              <button
                onClick={() => onRemoveItem(item.product.id, item.specification)}
                className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
              >
                <MaterialIcon name="delete" className="text-[1.1em]" />
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-6 border-t border-outline-variant/20 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-on-surface-variant text-body-md">Total</span>
            <ZerineDisplay amount={total} iconStyle="emoji" variant="price" size="lg" />
          </div>
          {insufficient && (
            <div className="flex items-center gap-2 bg-error/10 rounded-xl px-4 py-2 text-error text-body-sm">
              <MaterialIcon name="warning" className="text-[1.1em]" />
              No tienes suficientes Zerines para esta compra.
            </div>
          )}
          <Button
            onClick={onPurchase}
            disabled={submitting || insufficient}
            className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-body-md hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? "Procesando..." : "Comprar en Flourish & Blotts"}
          </Button>
        </div>
      )}
    </>
  );
}

export function CartSidebar({
  isOpen,
  onClose,
  items,
  getTotal,
  onRemoveItem,
  onPurchase,
  submitting,
  userZerines,
}: CartSidebarProps) {
  const theme = useTheme();
  const isDesktop = useIsDesktopMdUp();
  const fallbackSrc = getFallbackForProduct('flourish', theme);

  return (
    <>
      {/* Desktop: side drawer */}
      <div
        className={`hidden md:block fixed inset-0 z-60 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="absolute right-0 top-0 h-full w-full max-w-md bg-white glass-card rounded-l-2xl shadow-2xl flex flex-col border-l border-outline-variant/20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-outline-variant/20">
            <h2 className="font-display text-headline-lg text-on-surface">
              Mi Caldero
            </h2>
            <button
              onClick={onClose}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              aria-label="Cerrar carrito"
            >
              <MaterialIcon name="close" className="text-[1.2em]" />
            </button>
          </div>
          <CartContents
            items={items}
            getTotal={getTotal}
            onRemoveItem={onRemoveItem}
            onPurchase={onPurchase}
            userZerines={userZerines}
            submitting={submitting}
            fallbackSrc={fallbackSrc}
          />
        </div>
      </div>

      {/* Mobile: bottom sheet (only below md — the BottomSheet portals to
          document.body, so CSS `md:hidden` on a wrapper can't hide it) */}
      {!isDesktop && (
        <BottomSheet
          open={isOpen}
          onClose={onClose}
          title="Mi Caldero"
          ariaLabel="Carrito de compras Flourish & Blotts"
        >
          <div className="bg-white rounded-t-2xl flex flex-col -mx-6 -mb-6">
            <CartContents
              items={items}
              getTotal={getTotal}
              onRemoveItem={onRemoveItem}
              onPurchase={onPurchase}
              userZerines={userZerines}
              submitting={submitting}
              fallbackSrc={fallbackSrc}
            />
          </div>
        </BottomSheet>
      )}
    </>
  );
}

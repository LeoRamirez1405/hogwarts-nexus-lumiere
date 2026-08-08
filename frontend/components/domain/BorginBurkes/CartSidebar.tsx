"use client";

import Image from "next/image";
import { CartItem } from "@/lib/cartStore";
import { MaterialIcon, ZerineDisplay, BottomSheet } from "@/components/ui";
import { getFallbackForProduct } from "@/lib/fallbacks";
import { useTheme } from "@/lib/useTheme";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  getTotal: () => number;
  onRemoveItem: (productId: string) => void;
  onPurchase: () => Promise<void>;
  userZerines: number;
  submitting?: boolean;
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
  onRemoveItem: (productId: string) => void;
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
              name="shopping_basket"
              className="text-surface-dim text-5xl block mb-3"
            />
            <p className="text-surface-dim text-body-md">Tu cesta está vacía</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.product.id}
              className="flex items-center gap-4 p-4 bg-[#1c1b1b] rounded-xl border border-secondary/10"
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
                  <span className="text-surface-dim text-label-sm">x{item.quantity}</span>
                </div>
              </div>
              <button
                onClick={() => onRemoveItem(item.product.id)}
                className="p-2 rounded-full hover:bg-error-container text-surface-dim hover:text-error transition-colors"
              >
                <MaterialIcon name="delete" className="text-[1.1em]" />
              </button>
            </div>
          ))
        )}
      </div>

      {items.length > 0 && (
        <div className="p-6 border-t border-secondary/20 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-surface-dim text-body-md">Total</span>
            <ZerineDisplay amount={total} iconStyle="icon" variant="price" size="lg" />
          </div>
          {insufficient && (
            <div className="flex items-center gap-2 bg-error/15 rounded-xl px-4 py-2 text-error text-body-sm">
              <MaterialIcon name="warning" className="text-[1.1em]" />
              No tienes suficientes Zerines para esta compra.
            </div>
          )}
          <button
            onClick={onPurchase}
            disabled={insufficient || submitting}
            className="w-full crystal-gradient text-on-primary py-3 rounded-xl font-bold text-body-md hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {submitting ? "Procesando..." : "Comprar Ahora"}
          </button>
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
  userZerines,
  submitting = false,
}: CartSidebarProps) {
  const theme = useTheme();
  const isDesktop = useIsDesktopMdUp();
  const fallbackSrc = getFallbackForProduct("borgin", theme);

  return (
    <>
      {/* Desktop: side drawer */}
      <div
        className={`hidden md:block fixed inset-0 z-60 transition-opacity duration-200 ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      >
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
              onClick={onClose}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-inverse-surface text-surface-dim transition-colors"
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
          title="Cesta Oscura"
          ariaLabel="Carrito de compras Borgin & Burkes"
          className="glass-card--dark"
        >
          <div className="bg-[#2a2828] rounded-t-2xl flex flex-col -mx-6 -mb-6">
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
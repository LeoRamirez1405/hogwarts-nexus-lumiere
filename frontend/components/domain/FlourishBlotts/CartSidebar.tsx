import { CartItem } from "@/lib/cartStore";
import Image from "next/image";
import { MaterialIcon, Button, ZerineDisplay } from "@/components/ui";

interface CartSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  getTotal: () => number;
  onRemoveItem: (productId: string) => void;
  onPurchase: () => Promise<void>;
  submitting: boolean;
}

export function CartSidebar({
  isOpen,
  onClose,
  items,
  getTotal,
  onRemoveItem,
  onPurchase,
  submitting,
}: CartSidebarProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end md:items-center md:justify-end">
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} aria-hidden="true" />
      <aside className="relative z-50 w-full md:w-96 bg-white glass-card border-l border-outline-variant/20 h-full md:h-auto max-h-screen flex flex-col animate-slide-in">
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
          <h2 className="font-display text-title-md text-on-surface">Mi Caldero</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" aria-label="Cerrar carrito">
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <MaterialIcon name="shopping_cart" className="text-5xl text-outline-variant mb-3 block mx-auto" />
              <p className="text-on-surface-variant text-body-md">Tu caldero está vacío</p>
              <p className="text-on-surface-variant text-label-sm mt-1">Añade algunos libros para empezar</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex items-center gap-3 p-3 bg-surface-container rounded-xl">
                <Image
                  src={item.product.image_url || "/placeholder-book.jpg"}
                  alt={item.product.name}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                  unoptimized={item.product.image_url?.startsWith("http://localhost:8000/uploads/") || !!item.product.image_url?.startsWith("/placeholder-")}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="text-body-md font-medium text-on-surface truncate">{item.product.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <ZerineDisplay amount={item.product.price} iconStyle="emoji" variant="price" size="sm" />
                    <span className="text-on-surface-variant text-label-sm">x{item.quantity}</span>
                  </div>
                </div>
                <button onClick={() => onRemoveItem(item.product.id)} className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors">
                  <MaterialIcon name="delete" className="text-[1.1em]" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div className="p-4 border-t border-outline-variant/20 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-on-surface-variant text-body-md">Total</span>
              <ZerineDisplay amount={getTotal()} iconStyle="emoji" variant="price" size="lg" />
            </div>
            <Button onClick={onPurchase} disabled={submitting} className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold text-body-md hover:opacity-90 transition-all active:scale-[0.98] disabled:opacity-50">
              {submitting ? "Procesando..." : "Comprar en Flourish & Blotts"}
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}
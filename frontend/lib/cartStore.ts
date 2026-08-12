import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Product } from "./api";

export interface CartItem {
  product: Product;
  quantity: number;
  specification?: string;
}

const itemKey = (productId: string, specification?: string) =>
  `${productId}::${specification ?? ""}`;

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  addItem: (product: Product, specification?: string) => void;
  removeItem: (productId: string, specification?: string) => void;
  updateQuantity: (productId: string, quantity: number, specification?: string) => void;
  clearCart: () => void;
  toggleCart: () => void;
  getTotal: () => number;
  getCount: () => number;
}

function createCartStore(storageName: string) {
  return create<CartState>()(
    persist(
      (set, get) => ({
        items: [],
        isOpen: false,
        addItem: (product, specification) =>
          set((state) => {
            const key = itemKey(product.id, specification);
            const existing = state.items.find(
              (i) => itemKey(i.product.id, i.specification) === key
            );
            if (existing) {
              return {
                items: state.items.map((i) =>
                  itemKey(i.product.id, i.specification) === key
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                ),
              };
            }
            return {
              items: [...state.items, { product, quantity: 1, specification }],
            };
          }),
        removeItem: (productId, specification) =>
          set((state) => {
            const key = itemKey(productId, specification);
            return {
              items: state.items.filter(
                (i) => itemKey(i.product.id, i.specification) !== key
              ),
            };
          }),
        updateQuantity: (productId, quantity, specification) =>
          set((state) => {
            const key = itemKey(productId, specification);
            if (quantity <= 0) {
              return {
                items: state.items.filter(
                  (i) => itemKey(i.product.id, i.specification) !== key
                ),
              };
            }
            return {
              items: state.items.map((i) =>
                itemKey(i.product.id, i.specification) === key
                  ? { ...i, quantity }
                  : i
              ),
            };
          }),
        clearCart: () => set({ items: [], isOpen: false }),
        toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
        getTotal: () =>
          get().items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
        getCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      }),
      {
        name: storageName,
        // Persist only items, not isOpen (sidebar should always start closed).
        partialize: (state) => ({ items: state.items }),
      }
    )
  );
}

// Each marketplace gets its own independent cart so a purchase never mixes
// products from Borgin & Burkes and Flourish & Blotts in one batch request.
export const useBorginCartStore = createCartStore("hogwarts-cart-borgin");
export const useFlourishCartStore = createCartStore("hogwarts-cart-flourish");

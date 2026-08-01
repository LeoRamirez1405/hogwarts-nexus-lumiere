import { create } from "zustand";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id">) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { ...toast, id }] });
    setTimeout(() => {
      set({ toasts: get().toasts.filter((t) => t.id !== id) });
    }, 4000);
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));

/** Helper to surface an error from a failed operation with a friendly message. */
export function toastError(title: string, err?: unknown) {
  const detail =
    err instanceof Error && err.message
      ? err.message
      : err && typeof err === "object" && "detail" in err
        ? String((err as { detail: unknown }).detail)
        : undefined;
  useToastStore.getState().push({
    variant: "error",
    title,
    message: detail,
  });
  // Haptic feedback: error pattern on devices that support vibration
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate([100, 50, 100]);
  }
  if (err !== undefined) console.error(title, err);
}

export function toastSuccess(title: string, message?: string) {
  useToastStore.getState().push({ variant: "success", title, message });
}

export function toastInfo(title: string, message?: string) {
  useToastStore.getState().push({ variant: "info", title, message });
}

"use client";

import { useEffect, useRef } from "react";
import { create } from "zustand";
import Modal from "./Modal";
import Button from "./Button";
import { MaterialIcon } from "./MaterialIcon";

export interface ConfirmDialogOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "primary" | "danger" | "secondary";
  icon?: string;
  /** Runs when the user clicks Confirm. If it throws, the error is re-thrown
   * after the dialog closes; the caller usually surfaces it via toastError. */
  onConfirm: () => Promise<void> | void;
}

interface ConfirmState {
  open: boolean;
  processing: boolean;
  options: ConfirmDialogOptions | null;
  show: (opts: ConfirmDialogOptions) => void;
  hide: () => void;
  runConfirm: () => Promise<void>;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  processing: false,
  options: null,
  show: (opts) => set({ open: true, options: opts, processing: false }),
  hide: () => set({ open: false, options: null, processing: false }),
  runConfirm: async () => {
    const opts = get().options;
    if (!opts) return;
    set({ processing: true });
    try {
      await opts.onConfirm();
      set({ open: false, options: null, processing: false });
    } catch (err) {
      set({ processing: false, open: false, options: null });
      throw err;
    }
  },
}));

export function ConfirmDialog() {
  const open = useConfirmStore((s) => s.open);
  const processing = useConfirmStore((s) => s.processing);
  const options = useConfirmStore((s) => s.options);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && cancelBtnRef.current) cancelBtnRef.current.focus();
  }, [open]);

  const handleClose = () => {
    if (!processing) useConfirmStore.getState().hide();
  };

  if (!options) return null;

  return (
    <Modal open={open} onClose={handleClose} size="sm">
      <div className="p-6 space-y-5">
        <div className="flex items-start gap-4">
          {options.icon && (
            <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
              <MaterialIcon
                name={options.icon}
                className={`text-2xl ${options.variant === "danger" ? "text-error" : "text-primary"}`}
                filled={options.variant === "danger"}
              />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="font-display text-title-md text-on-surface">
              {options.title}
            </h2>
            {options.message && (
              <p className="text-body-sm text-on-surface-variant mt-1 leading-relaxed">
                {options.message}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button
            ref={cancelBtnRef}
            variant="secondary"
            onClick={handleClose}
            disabled={processing}
            className="flex-1"
          >
            {options.cancelLabel ?? "Cancelar"}
          </Button>
          <Button
            variant={options.variant === "danger" ? "danger" : "primary"}
            onClick={() => {
              useConfirmStore
                .getState()
                .runConfirm()
                .catch(() => {
                  /* error already surfaced by caller via toastError */
                });
            }}
            disabled={processing}
            className="flex-1"
          >
            {processing
              ? "Procesando..."
              : options.confirmLabel ?? "Confirmar"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Show a Modal-based confirm dialog (replaces native `confirm()`).
 *
 * Pass an `onConfirm` callback that runs when the user accepts — cancelling
 * just hides the dialog. Any thrown error in `onConfirm` is swallowed here
 * because the caller usually wraps the call in its own try/catch + toastError.
 *
 * Usage:
 *   confirmDialog({
 *     title: "Eliminar usuario?",
 *     message: "Esta acción no se puede deshacer.",
 *     variant: "danger",
 *     icon: "delete",
 *     onConfirm: async () => {
 *       try {
 *         await api.deleteUser(id);
 *         refresh();
 *         toastSuccess("Usuario eliminado");
 *       } catch (e) {
 *         toastError("No se pudo eliminar el usuario", e);
 *       }
 *     },
 *   });
 */
export function confirmDialog(opts: ConfirmDialogOptions): void {
  useConfirmStore.getState().show(opts);
}

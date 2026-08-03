"use client";

import { useToastStore } from "@/lib/toastStore";
import { MaterialIcon } from "./MaterialIcon";

const VARIANT_STYLES: Record<
  string,
  { icon: string; ring: string; iconColor: string }
> = {
  success: {
    icon: "check_circle",
    ring: "border-success/30",
    iconColor: "text-success",
  },
  error: {
    icon: "error",
    ring: "border-error/30",
    iconColor: "text-error",
  },
  info: {
    icon: "info",
    ring: "border-primary/30",
    iconColor: "text-primary",
  },
};

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-20 md:top-6 right-4 left-4 md:left-auto z-[100] flex flex-col items-end gap-2 pointer-events-none"
    >
      {toasts.map((t) => {
        const styles = VARIANT_STYLES[t.variant] ?? VARIANT_STYLES.info;
        return (
          <div
            key={t.id}
            role="alert"
            className={`pointer-events-auto w-full md:w-96 glass-card rounded-xl border ${styles.ring} px-4 py-3 shadow-xl flex items-start gap-3 animate-[toast-in_0.2s_ease-out]`}
          >
            <MaterialIcon
              name={styles.icon}
              className={`text-xl shrink-0 ${styles.iconColor}`}
              filled
            />
            <div className="flex-1 min-w-0">
              <p className="text-body-sm font-semibold text-on-surface">
                {t.title}
              </p>
              {t.message && (
                <p className="text-label-sm text-on-surface-variant mt-0.5 break-words">
                  {t.message}
                </p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              aria-label="Cerrar notificacion"
            >
              <MaterialIcon name="close" className="text-base" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

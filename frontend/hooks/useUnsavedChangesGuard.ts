"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

interface UseUnsavedChangesGuardOptions {
  /** Whether there are unsaved changes */
  hasUnsavedChanges: boolean;
  /** Message to show in the confirmation dialog */
  message?: string;
  /** Callback when user confirms leaving (to discard changes) */
  onLeave?: () => void;
}

export function useUnsavedChangesGuard({
  hasUnsavedChanges,
  message = "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
  onLeave,
}: UseUnsavedChangesGuardOptions) {
  const router = useRouter();
  const pathname = usePathname();

  // Handle browser back/forward and tab close
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, message]);

  // Handle Next.js router navigation via custom hook
  const guardedPush = useCallback(
    (url: string, options?: { scroll?: boolean }) => {
      if (!hasUnsavedChanges) {
        return router.push(url, options);
      }
      if (url === pathname) {
        return router.push(url, options);
      }

      // Use confirmDialog instead of window.confirm
      return new Promise<boolean>((resolve) => {
        confirmDialog({
          title: "Cambios sin guardar",
          message,
          variant: "secondary",
          icon: "warning",
          confirmLabel: "Salir",
          cancelLabel: "Quedarse",
          onConfirm: async () => {
            if (onLeave) onLeave();
            await router.push(url, options);
            resolve(true);
          },
        });
        // The dialog resolves to false if cancelled (returns null from show)
        // We need to handle the cancel case - it doesn't resolve the promise
        // So we set a small timeout to resolve false if not resolved
        setTimeout(() => resolve(false), 100);
      });
    },
    [hasUnsavedChanges, message, onLeave, pathname, router]
  );

  const guardedReplace = useCallback(
    (url: string, options?: { scroll?: boolean }) => {
      if (!hasUnsavedChanges) {
        return router.replace(url, options);
      }
      if (url === pathname) {
        return router.replace(url, options);
      }

      return new Promise<boolean>((resolve) => {
        confirmDialog({
          title: "Cambios sin guardar",
          message,
          variant: "secondary",
          icon: "warning",
          confirmLabel: "Salir",
          cancelLabel: "Quedarse",
          onConfirm: async () => {
            if (onLeave) onLeave();
            await router.replace(url, options);
            resolve(true);
          },
        });
        setTimeout(() => resolve(false), 100);
      });
    },
    [hasUnsavedChanges, message, onLeave, pathname, router]
  );

  return { guardedPush, guardedReplace };
}

/** Hook for forms that tracks dirty state automatically */
export function useFormDirtyState<T extends Record<string, unknown>>(
  initialValues: T,
  currentValues: T
): { isDirty: boolean; resetDirty: () => void } {
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    const checkDirty = () => {
      const hasChanges = Object.keys(initialValues).some(
        (key) => initialValues[key] !== currentValues[key]
      );
      setIsDirty(hasChanges);
    };
    // Use setTimeout to avoid synchronous setState in effect
    const timer = setTimeout(checkDirty, 0);
    return () => clearTimeout(timer);
  }, [initialValues, currentValues]);

  const resetDirty = useCallback(() => {
    setIsDirty(false);
  }, []);

  return { isDirty, resetDirty };
}
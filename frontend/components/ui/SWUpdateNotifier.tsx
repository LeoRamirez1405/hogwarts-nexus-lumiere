"use client";

import { useEffect } from "react";
import { useServiceWorker } from "@/hooks/usePWA";
import { useToastStore } from "@/lib/toastStore";

export function SWUpdateNotifier() {
  const { updateAvailable, applyUpdate } = useServiceWorker();
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    if (updateAvailable) {
      push({
        variant: "info",
        title: "Nueva versión disponible",
        message: "Se ha descargado una actualización. Pulsa para recargar.",
      });
      
      const handleClick = () => {
        applyUpdate();
      };

      window.addEventListener("click", handleClick, { once: true });
      
      return () => {
        window.removeEventListener("click", handleClick);
      };
    }
  }, [updateAvailable, applyUpdate, push]);

  return null;
}
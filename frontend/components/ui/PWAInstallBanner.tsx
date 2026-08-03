"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWA";
import { MaterialIcon } from "./MaterialIcon";

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, install } = usePWAInstall();
  const isIOS = typeof window !== "undefined"
    ? /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
    : false;

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("pwa-banner-dismissed") === "true";
    }
    return false;
  });

  // Only show if installable and not already installed
  if (!isInstallable || isInstalled || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    await install();
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-banner-dismissed", "true");
    setDismissed(true);
  };

  return (
    <div
      className="fixed top-16 lg:top-20 left-4 right-4 md:left-auto md:right-4 md:w-[32rem] z-[100] animate-slide-down"
      role="dialog"
      aria-label="Instalar aplicación"
    >
      <div className="rounded-2xl shadow-2xl border border-primary/20 overflow-hidden animate-fade-in" style={{
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      }}>
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 flex-shrink-0 inline-flex items-center justify-center rounded-xl bg-primary/10">
              <MaterialIcon name="diamond" className="text-2xl text-primary" filled />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display text-title-md text-on-surface">
                Instala Hogwarts Nexus
              </h3>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Añade la app a tu pantalla de inicio para acceso rápido y notificaciones push.
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors shrink-0"
              aria-label="Cerrar"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>

          {isIOS && (
            <div className="mt-4 p-3 bg-surface-container-high rounded-xl border border-outline-variant/20">
              <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
                <MaterialIcon name="ios_share" className="text-lg" />
                En iOS: toca <strong>Compartir</strong> → <strong>Añadir a pantalla de inicio</strong>
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleInstall}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shrink-0"
            >
              <MaterialIcon name="download" className="text-base" />
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="inline-flex items-center justify-center px-4 py-2.5 text-on-surface font-medium rounded-xl hover:bg-surface-container-high transition-colors shrink-0"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
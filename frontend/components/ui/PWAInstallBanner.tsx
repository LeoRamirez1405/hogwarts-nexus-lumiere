"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWA";
import { MaterialIcon } from "./MaterialIcon";

export default function PWAInstallBanner() {
  const { isInstallable, isInstalled, isStandalone, install } = usePWAInstall();
  const [showHelp, setShowHelp] = useState(false);
  const isIOS = typeof window !== "undefined"
    ? /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
    : false;
  const isAndroid = typeof window !== "undefined"
    ? /Android/i.test(navigator.userAgent)
    : false;

  const [dismissed, setDismissed] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("pwa-banner-dismissed") === "true";
    }
    return false;
  });

  // Banner solo si hay prompt nativo o es iOS (nunca dispara beforeinstallprompt).
  if (!isInstallable && !isIOS) {
    return null;
  }
  if (isInstalled || isStandalone || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) setShowHelp(true);
    } else {
      setShowHelp(true);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem("pwa-banner-dismissed", "true");
    setDismissed(true);
  };

  const helpText = isIOS
    ? "En iOS: toca Compartir → Añadir a pantalla de inicio"
    : isAndroid
      ? "En Android: menú ⋮ → Añadir a pantalla de inicio"
      : "Usa el icono de instalar en la barra de direcciones del navegador";

  return (
    <div
      className="fixed top-16 lg:top-20 left-4 right-4 md:left-auto md:right-4 md:w-lg z-100 animate-slide-down"
      role="dialog"
      aria-label="Instalar aplicación"
    >
      <div
        className="rounded-2xl shadow-2xl border border-primary/20 overflow-hidden animate-fade-in"
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        <div className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-xl bg-primary/10">
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

          {showHelp && (
            <div className="mt-4 p-3 bg-surface-container-high rounded-xl border border-outline-variant/20">
              <p className="text-body-sm text-on-surface-variant flex items-center gap-2">
                <MaterialIcon name="ios_share" className="text-lg" />
                {helpText}
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
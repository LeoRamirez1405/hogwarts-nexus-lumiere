"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWA";
import { MaterialIcon } from "@/components/ui";

interface PWAInstallPromptProps {
  variant?: "banner" | "button" | "inline" | "row";
  className?: string;
}

export default function PWAInstallPrompt({ variant = "banner", className = "" }: PWAInstallPromptProps) {
  const { isInstallable, isInstalled, isStandalone, install } = usePWAInstall();
  const [showHelp, setShowHelp] = useState(false);
  const isIOS = typeof window !== "undefined"
    ? /iPad|iPhone|iPod/.test(navigator.userAgent) && !("MSStream" in window)
    : false;
  const isAndroid = typeof window !== "undefined"
    ? /Android/i.test(navigator.userAgent)
    : false;

  // Local state for banner dismissal (session only)
  const [dismissed, setDismissed] = useState(false);

  // The install option is always offered (unless already installed/running
  // standalone). When the native prompt never fired (untrusted cert, HTTP,
  // iOS Safari, Chrome heuristics), the button shows manual instructions
  // instead of doing nothing.
  if (isInstalled || isStandalone) {
    return null;
  }

  if (variant === "banner" && (!isInstallable && !isIOS || dismissed)) {
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
    setDismissed(true);
  };

  const helpText = isIOS
    ? "En iOS: toca Compartir → Añadir a pantalla de inicio"
    : isAndroid
      ? "En Android: menú ⋮ → Añadir a pantalla de inicio"
      : "Usa el icono de instalar en la barra de direcciones del navegador";

  if (variant === "row") {
    return (
      <div>
        <button
          onClick={handleInstall}
          className="w-full flex items-center gap-3 px-4 py-3 text-body-md text-on-surface hover:bg-surface-container-high transition-colors text-left"
        >
          <MaterialIcon name="download" className="text-lg" />
          Instalar App
        </button>
        {showHelp && (
          <p className="px-4 pb-3 -mt-1 text-label-sm text-on-surface-variant">
            {helpText}
          </p>
        )}
      </div>
    );
  }

  if (variant === "button") {
    return (
      <div className="space-y-2">
        <button
          onClick={handleInstall}
          className={`w-full sm:w-auto inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors ${className}`}
        >
          <MaterialIcon name="download" className="text-lg" />
          Instalar App
        </button>
        {showHelp && (
          <p className="text-label-sm text-on-surface-variant px-1">
            {helpText}
          </p>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-xl ${className}`}>
        <MaterialIcon name="diamond" className="text-2xl text-primary" filled />
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-medium text-on-surface">
            Instala Hogwarts Nexus
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {showHelp ? helpText : "Accede rápido desde tu pantalla de inicio"}
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="px-3 py-1.5 bg-primary text-white text-label-md rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          Instalar
        </button>
      </div>
    );
  }

  // Banner variant (bottom sheet style for mobile)
  return (
    <div
      className={`fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-[28rem] z-50 animate-slide-up ${className}`}
      role="dialog"
      aria-label="Instalar aplicación"
    >
      <div className="bg-surface rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden">
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
                Añade la app a tu pantalla de inicio para acceso rápido y notificaciones.
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
              className="flex-1 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              <MaterialIcon name="download" className="inline-block align-middle mr-1" />
              Instalar
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2.5 text-on-surface font-medium rounded-xl hover:bg-surface-container-high transition-colors"
            >
              Ahora no
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
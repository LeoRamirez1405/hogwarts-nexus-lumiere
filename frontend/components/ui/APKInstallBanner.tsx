"use client";

import { useEffect, useState } from "react";
import { useAPKInstall } from "@/hooks/useAPKInstall";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { useAuthStore } from "@/lib/authStore";

export default function APKInstallBanner() {
  const { apkInfo, loading, downloading, fetchAPKInfo, downloadAndInstall } = useAPKInstall();
  const { user } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const isAndroid = typeof window !== "undefined"
    ? /Android/i.test(navigator.userAgent)
    : false;
  const isCapacitor = typeof window !== "undefined" &&
    !!(window as { Capacitor?: { isNative?: boolean } }).Capacitor?.isNative;

  useEffect(() => {
    if (isAndroid && !isCapacitor && user && !dismissed) {
      fetchAPKInfo();
    }
  }, [fetchAPKInfo, isAndroid, isCapacitor, user, dismissed]);

  // Solo mostrar en Android, no en app nativa Capacitor, y solo si hay usuario logueado
  if (!isAndroid || isCapacitor || !user || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    sessionStorage.setItem("apk-banner-dismissed", "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    await downloadAndInstall();
    // No cerrar automáticamente - dejar que el usuario vea las instrucciones
    setShowHelp(true);
  };

  const helpText = "Si la descarga no inicia automáticamente, toca el archivo en las notificaciones o abre la app 'Archivos' → 'Descargas' → hogwarts-nexus.apk. Si aparece 'Instalación bloqueada', ve a Configuración → Apps → Acceso especial → Instalar apps desconocidas y activa Chrome (o tu navegador).";

  if (loading) {
    return (
      <div
        className="fixed top-16 lg:top-20 left-4 right-4 md:left-auto md:right-4 md:w-lg z-100 animate-slide-down"
        role="status"
        aria-label="Verificando APK"
      >
        <div
          className="rounded-2xl shadow-2xl border border-primary/20 overflow-hidden animate-fade-in"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="p-4 sm:p-5 flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
            <span className="font-display text-title-md text-on-surface">
              Verificando instalación...
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (!apkInfo?.available) {
    return (
      <div
        className="fixed top-16 lg:top-20 left-4 right-4 md:left-auto md:right-4 md:w-lg z-100 animate-slide-down"
        role="dialog"
        aria-label="APK no disponible"
      >
        <div
          className="rounded-2xl shadow-2xl border border-outline-variant/20 overflow-hidden animate-fade-in"
          style={{
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
          }}
        >
          <div className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 shrink-0 inline-flex items-center justify-center rounded-xl bg-surface-container-high">
                <MaterialIcon name="info" className="text-2xl text-on-surface-variant" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-title-md text-on-surface">
                  APK no disponible
                </h3>
                <p className="text-body-sm text-on-surface-variant mt-1">
                  {apkInfo?.message || "El APK aún no se ha generado. Contacta al administrador."}
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-16 lg:top-20 left-4 right-4 md:left-auto md:right-4 md:w-lg z-100 animate-slide-down"
      role="dialog"
      aria-label="Instalar Hogwarts Nexus"
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
                Descarga la app nativa para Android ({apkInfo.size_mb} MB). Acceso rápido, notificaciones push y experiencia completa.
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
              <p className="text-body-sm text-on-surface-variant flex items-start gap-2">
                <MaterialIcon name="help_outline" className="text-lg shrink-0 mt-0.5" />
                {helpText}
              </p>
            </div>
          )}

          <div className="mt-4 flex gap-2">
            <button
              onClick={handleInstall}
              disabled={downloading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MaterialIcon name={downloading ? "hourglass_empty" : "download"} className="text-base" />
              {downloading ? "Descargando..." : "Instalar App"}
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
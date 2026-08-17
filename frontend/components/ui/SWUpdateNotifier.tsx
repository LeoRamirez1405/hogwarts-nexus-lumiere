"use client";

import { useEffect } from "react";
import { useAppVersion } from "@/hooks/usePWA";
import { useToastStore } from "@/lib/toastStore";

export function SWUpdateNotifier() {
  const {
    hasUpdate,
    isForceUpdate,
    isMinSupported,
    latestVersion,
    currentVersion,
    releaseNotes,
    apkDownloadUrl,
    isCapacitor,
    isAndroid,
    isApkUpdateAvailable,
    isSwUpdateAvailable,
  } = useAppVersion();
  const push = useToastStore((s) => s.push);

  useEffect(() => {
    if (!hasUpdate) return;

    // If version is below minimum supported, force update
    if (!isMinSupported) {
      push({
        variant: "error",
        title: "Versión no compatible",
        message: `Tu versión (${currentVersion}) ya no es compatible. Actualiza para seguir usando la app.`,
      });
      // Could redirect to update page here
      return;
    }

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

    let title = "Nueva versión disponible";
    let message = `Versión ${latestVersion} lista.`;

    if (releaseNotes) {
      message += ` ${releaseNotes}`;
    }

    if (isCapacitor && isAndroid) {
      title = "Actualización de app Android";
      message = `Versión ${latestVersion} disponible. Toca para descargar e instalar.`;
    } else if (isIOS) {
      title = "Actualización disponible";
      message = `Versión ${latestVersion} lista. La app se actualizará al recargar.`;
    } else {
      // Web PWA
      message = `Versión ${latestVersion} descargada. Pulsa para recargar.`;
    }

    push({
      variant: isForceUpdate ? "error" : "info",
      title,
      message,
    });

    const handleClick = () => {
      if (isCapacitor && isAndroid && apkDownloadUrl) {
        // Android Capacitor: download and install APK
        window.location.href = apkDownloadUrl;
      } else if (isIOS || (!isCapacitor && isSwUpdateAvailable)) {
        // iOS or Web PWA: reload to apply SW update
        window.location.reload();
      } else {
        // Fallback: just reload
        window.location.reload();
      }
    };

    window.addEventListener("click", handleClick, { once: true });

    return () => {
      window.removeEventListener("click", handleClick);
    };
  }, [hasUpdate, isForceUpdate, isMinSupported, latestVersion, currentVersion, releaseNotes, apkDownloadUrl, isCapacitor, isAndroid, isApkUpdateAvailable, isSwUpdateAvailable, push]);

  return null;
}
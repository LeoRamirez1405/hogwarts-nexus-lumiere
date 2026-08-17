"use client";

import { useState, useCallback } from "react";
import { toastInfo, toastError, toastSuccess } from "@/lib/toastStore";

interface APKInfo {
  available: boolean;
  filename?: string;
  size_mb?: number;
  download_url?: string;
  message?: string;
}

interface UseAPKInstallReturn {
  apkInfo: APKInfo | null;
  loading: boolean;
  downloading: boolean;
  fetchAPKInfo: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export function useAPKInstall(): UseAPKInstallReturn {
  const [apkInfo, setApkInfo] = useState<APKInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchAPKInfo = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/apk/info", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch APK info");
      const data = await res.json();
      setApkInfo(data);
    } catch (error) {
      console.error("Failed to fetch APK info:", error);
      setApkInfo({ available: false, message: "Error al verificar APK" });
    } finally {
      setLoading(false);
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!apkInfo?.download_url) {
      toastError("Error", new Error("No hay APK disponible para descargar"));
      return;
    }

    setDownloading(true);
    toastInfo("Descargando APK", "Preparando instalación...");

    try {
      const res = await fetch(apkInfo.download_url, {
        credentials: "include",
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Error al descargar APK");
      }

      const blob = await res.blob();
      
      // Crear URL del blob y desencadenar descarga
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = apkInfo.filename || "hogwarts-nexus.apk";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toastSuccess(
        "APK descargado",
        "Abre el archivo desde las notificaciones o la app Archivos para instalar. Si no se abre automáticamente, ve a Configuración → Apps → Acceso especial → Instalar apps desconocidas y habilita tu navegador."
      );
    } catch (error) {
      console.error("APK download failed:", error);
      toastError("Error al descargar", error as Error);
    } finally {
      setDownloading(false);
    }
  }, [apkInfo]);

  return {
    apkInfo,
    loading,
    downloading,
    fetchAPKInfo,
    downloadAndInstall,
  };
}
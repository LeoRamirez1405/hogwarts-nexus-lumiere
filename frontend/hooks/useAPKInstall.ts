"use client";

import { useState, useCallback } from "react";
import { toastInfo, toastError } from "@/lib/toastStore";

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
  fetchAPKInfo: () => Promise<APKInfo | null>;
  downloadAndInstall: () => Promise<void>;
}

export function useAPKInstall(): UseAPKInstallReturn {
  const [apkInfo, setApkInfo] = useState<APKInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const fetchAPKInfo = useCallback(async (): Promise<APKInfo | null> => {
    setLoading(true);
    try {
      const res = await fetch("/api/app/apk/info", {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch APK info");
      const data = await res.json();
      setApkInfo(data);
      return data;
    } catch (error) {
      console.error("Failed to fetch APK info:", error);
      setApkInfo({ available: false, message: "Error al verificar APK" });
      return null;
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
      const url = apkInfo.download_url;

      // Navegación directa en ambos casos:
      // - URL absoluta (GitHub): GitHub bloquea CORS para fetch(), hay que navegar.
      // - URL relativa (backend /api/app/apk): el response trae Content-Disposition:
      //   attachment, así el browser inicia la descarga nativa sin salir de la app,
      //   y las cookies de auth se envían automáticamente (mismo origen).
      // fetch()+blob() + revokeObjectURL inmediato aborta la descarga en Chrome
      // móvil ("no termina de descargar nunca"), por eso no se usa.
      window.location.href = url;
      setDownloading(false);
      toastInfo(
        "Descarga iniciada",
        "Revisa el área de descargas de tu navegador. Cuando termine, toca el archivo Nexus.apk para instalar."
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
"use client";

import { useState } from "react";
import { usePWAInstall } from "@/hooks/usePWA";
import { useAPKInstall } from "@/hooks/useAPKInstall";
import { MaterialIcon } from "@/components/ui";
import { isAndroidWeb, isNativeApp } from "@/lib/native";

// Item de menú "Instalar App".
// - App nativa Capacitor: oculto (la app ya está instalada).
// - Android web: descarga el APK directamente. NUNCA muestra el prompt PWA
//   de "añadir a pantalla de inicio".
// - iOS/desktop: prompt PWA estándar.
export default function InstallMenuItem() {
  const { isInstalled, isStandalone, install } = usePWAInstall();
  const { apkInfo, downloading, fetchAPKInfo, downloadAndInstall } = useAPKInstall();
  const [showHelp, setShowHelp] = useState(false);

  if (isNativeApp() || isInstalled || isStandalone) {
    return null;
  }

  const isAndroid = isAndroidWeb();

  const handleClick = async () => {
    if (isAndroid) {
      const info = apkInfo ?? (await fetchAPKInfo());
      if (!info?.download_url) {
        setShowHelp(true);
        return;
      }
      await downloadAndInstall();
    } else {
      const ok = await install();
      if (!ok) setShowHelp(true);
    }
  };

  const helpText = isAndroid
    ? "Si la descarga no inicia, revisa Descargas e instala Nexus.apk. Si aparece 'Instalación bloqueada', ve a Configuración → Apps → Acceso especial → Instalar apps desconocidas."
    : "Usa el icono de instalar en la barra de direcciones del navegador";

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={downloading}
        className="w-full flex items-center gap-3 px-4 py-3 text-body-md text-on-surface hover:bg-surface-container-high transition-colors text-left disabled:opacity-50"
      >
        <MaterialIcon name={downloading ? "hourglass_empty" : "download"} className="text-lg" />
        {downloading ? "Descargando..." : "Instalar App"}
      </button>
      {showHelp && (
        <p className="px-4 pb-3 -mt-1 text-label-sm text-on-surface-variant">
          {helpText}
        </p>
      )}
    </div>
  );
}
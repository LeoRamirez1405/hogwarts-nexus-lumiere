"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import { toastInfo, toastError } from "@/lib/toastStore";
import { isAndroidWeb, isNativeApp } from "@/lib/native";

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface AppVersionInfo {
  current: string;
  latest: string;
  version_code: number;
  apk_download_url: string;
  release_notes: string;
  force_update: boolean;
  min_supported_version: string;
  available_update: boolean;
}

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, _setLatestVersion] = useState<string | null>(null);
  const [availableUpdate, _setAvailableUpdate] = useState<boolean | null>(null);
  const swReloadPending = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator;
    setTimeout(() => setIsSupported(supported), 0);

    if (!supported) return;

    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW !== "true") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
      return;
    }

    const isSecureContext = window.isSecureContext;

    if (!isSecureContext) {
      console.log("[SW] Skipping registration: not a secure context");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        setRegistration(reg);
        setIsRegistered(true);
        console.log("[SW] Registered:", reg.scope);

        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              setUpdateAvailable(true);
            }
          });
        });
      })
      .catch((error) => {
        if (error.name !== "SecurityError") {
          console.error("[SW] Registration failed:", error);
        } else {
          console.log("[SW] Registration skipped: SecurityError (likely insecure context)");
        }
      });

    // Register FCM messaging Service Worker (for background FCM messages)
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/firebase-messaging-sw.js", { scope: "/" })
        .then((reg) => {
          console.log("[FCM SW] Registered:", reg.scope);
        })
        .catch((error) => {
          console.warn("[FCM SW] Registration failed:", error);
        });
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!swReloadPending.current) return;
      swReloadPending.current = false;
      console.log("[SW] Update applied, reloading...");
      window.location.reload();
    });
  }, []);

  const applyUpdate = useCallback(async () => {
    if (!registration || !registration.waiting) return;
    swReloadPending.current = true;
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
    setUpdateAvailable(false);
  }, [registration]);

  return {
    registration,
    isSupported,
    isRegistered,
    updateAvailable,
    latestVersion: latestVersion ?? "0.1.0",
    availableUpdate: availableUpdate ?? false,
    applyUpdate,
  };
}

export function useAppVersion() {
  const [versionInfo, setVersionInfo] = useState<AppVersionInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);

  const isCapacitor = isNativeApp();
  const isAndroid = isAndroidWeb();

  const fetchVersion = useCallback(async () => {
    if (checking) return;
    setChecking(true);
    try {
      const res = await fetch("/api/app/version", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) throw new Error("version check failed");
      const data = await res.json();
      setVersionInfo(data);
      setLastChecked(Date.now());
    } catch (error) {
      console.error("Failed to check app version:", error);
    } finally {
      setChecking(false);
    }
  }, [checking]);

  const startPeriodicCheck = useCallback((intervalMs = 60 * 60 * 1000) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(fetchVersion, intervalMs);
  }, [fetchVersion]);

  const stopPeriodicCheck = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Initial fetch (runs once on mount)
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      fetchVersion();
    }
  }, [fetchVersion]);

  // Periodic check
  useEffect(() => {
    startPeriodicCheck();
    return () => stopPeriodicCheck();
  }, [startPeriodicCheck, stopPeriodicCheck]);

  const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || "0.1.0";
  const hasUpdate = versionInfo?.available_update ?? false;
  const isForceUpdate = versionInfo?.force_update ?? false;
  const isMinSupported = versionInfo
    ? compareVersions(currentVersion, versionInfo.min_supported_version) >= 0
    : true;

  return {
    versionInfo,
    currentVersion,
    latestVersion: versionInfo?.latest ?? currentVersion,
    hasUpdate,
    isForceUpdate,
    isMinSupported,
    isChecking: checking,
    lastChecked,
    apkDownloadUrl: versionInfo?.apk_download_url,
    releaseNotes: versionInfo?.release_notes,
    versionCode: versionInfo?.version_code,
    isCapacitor,
    isAndroid,
    // For Capacitor Android: APK update available
    isApkUpdateAvailable: isCapacitor && isAndroid && hasUpdate,
    // For PWA: Service Worker update available
    isSwUpdateAvailable: !isCapacitor && hasUpdate,
    refresh: fetchVersion,
  };
}

// Simple semantic version comparison
function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

export function usePushSubscription() {
  const { user } = useAuthStore();
  const { registration } = useServiceWorker();
  const [subscription, setSubscription] = useState<PushSubscriptionData | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const urlBase64ToUint8Array = useCallback((base64String: string): BufferSource => {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const fetchVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch("/api/push/vapid-public-key");
      if (!res.ok) return null;
      const data = await res.json();
      return data.public_key;
    } catch (error) {
      console.error('Failed to fetch VAPID key:', error);
      return null;
    }
  }, []);

  const ensureRegistration = useCallback(async (silent: boolean): Promise<ServiceWorkerRegistration | null> => {
    if (registration) return registration;
    try {
      return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (!silent) {
        if (err.name === "SecurityError") {
          toastError(
            "Certificado no confiable",
            new Error(
              "Este dispositivo no confía en el certificado de desarrollo. Instala la CA raíz desde " +
                `${window.location.origin}/rootCA.crt` +
                " y reinicia el navegador."
            )
          );
        } else {
          toastError("No se pudo registrar el Service Worker", error as Error);
        }
      }
      return null;
    }
  }, [registration]);

  const subscribe = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!user) return;

    if (typeof window !== "undefined" && !window.isSecureContext) {
      if (!silent) {
        toastError(
          "Se necesita HTTPS",
          new Error("Las notificaciones requieren HTTPS (https://...) o localhost")
        );
      }
      return;
    }

    if (!("PushManager" in window)) {
      if (!silent) toastError("Notificaciones push no soportadas", new Error("PushManager not available"));
      return;
    }

    const swRegistration = await ensureRegistration(silent);
    if (!swRegistration) return;

    setLoading(true);
    try {
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        if (!silent) toastError("Push no configurado", new Error("VAPID key not available"));
        return;
      }

      const sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      const subscriptionData = sub.toJSON();
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          subscription_json: JSON.stringify(subscriptionData),
          user_agent: navigator.userAgent,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to save subscription");
      }

      setSubscription(subscriptionData as PushSubscriptionData);
      setIsSubscribed(true);
      toastInfo("Notificaciones activadas", "Recibirás notificaciones incluso con la app cerrada");
    } catch (error) {
      const err = error as { name?: string; message?: string };
      if (silent) {
        console.warn("Auto push subscribe failed (silenced):", error);
        return;
      }
      console.error("Subscribe error:", error);
      if (err.name === "AbortError" || /push service|registration failed/i.test(err.message || "")) {
        const isBrave = typeof window !== "undefined" && (window as { brave?: unknown }).brave !== undefined;
        if (isBrave) {
          toastError(
            "Brave bloquea el push",
            new Error(
              "Abre brave://settings/privacy y activa 'Use Google services for push messaging'. Luego reinicia Brave."
            )
          );
          return;
        }
        const host = typeof window !== "undefined" ? window.location.hostname : "";
        const isIpOrigin = /^\d{1,3}(\.\d{1,3}){3}$|^\[?[0-9a-fA-F:]+\]?$/.test(host) && host !== "localhost" && host !== "127.0.0.1" && host !== "::1";
        if (isIpOrigin) {
          toastError(
            "Chrome no permite push por IP",
            new Error(
              "Usa https://localhost:3000 (o un dominio real) para activar notificaciones. Chrome bloquea push en direcciones IP."
            )
          );
        } else {
          toastError(
            "El navegador bloqueó el push",
            new Error(
              window.isSecureContext
                ? "Tu navegador no confía en este certificado o no alcanza el servicio push. Instala el certificado raíz (rootCA.crt) en este dispositivo."
                : "Verifica que uses https:// y que tu red permita el push service del navegador"
            )
          );
        }
      } else if (err.name === "NotAllowedError") {
        toastError("Permiso denegado", new Error("Habilita las notificaciones en los ajustes del navegador"));
      } else if (err.name === "NotSupportedError" || /not supported/i.test(err.message || "")) {
        const isIos = typeof navigator !== "undefined" && /iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isIos) {
          toastError(
            "Push solo desde la app instalada",
            new Error(
              "En iPhone: Compartir → Añadir a pantalla de inicio, abre la app desde ahí y activa las notificaciones."
            )
          );
        } else {
          toastError("Push no soportado en este navegador", error as Error);
        }
      } else {
        toastError("No se pudo activar push", error as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [user, fetchVapidKey, urlBase64ToUint8Array, ensureRegistration]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !registration || !("pushManager" in registration)) return;

    setLoading(true);
    try {
      await registration.pushManager.getSubscription().then((sub) => sub?.unsubscribe());

      await fetch("/api/push/unsubscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      setSubscription(null);
      setIsSubscribed(false);
      toastInfo("Notificaciones desactivadas", "Ya no recibirás notificaciones push");
    } catch (error) {
      console.error("Unsubscribe error:", error);
      toastError("No se pudo desactivar push", error as Error);
    } finally {
      setLoading(false);
    }
  }, [registration, subscription]);

  useEffect(() => {
    if (!registration || !("pushManager" in registration)) return;

    registration.pushManager
      .getSubscription()
      .then((sub) => {
        if (sub) {
          setSubscription(sub.toJSON() as PushSubscriptionData);
          setIsSubscribed(true);
        }
      })
      .catch(() => {});
  }, [registration]);

  return { subscription, isSubscribed, loading, subscribe, unsubscribe };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isSecureContext, setIsSecureContext] = useState(false);

  useEffect(() => {
    const checkEnv = () => {
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone === true;
      setIsStandalone(standalone);
      setIsSecureContext(Boolean(window.isSecureContext));
      // En app nativa Capacitor no hay instalación PWA posible
      if (isNativeApp() || standalone) {
        setIsInstalled(true);
        return;
      }
    };
    const t = setTimeout(checkEnv, 0);
    if (window.matchMedia("(display-mode: standalone)").matches) {
      return () => window.clearTimeout(t);
    }

    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt as EventListener);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toastInfo("App instalada", "Hogwarts Nexus ya está en tu pantalla de inicio");
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to install PWA:', error);
      return false;
    }
  }, [deferredPrompt]);

  return { isInstallable, isInstalled, isStandalone, isSecureContext, install };
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
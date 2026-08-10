"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import { toastInfo, toastError } from "@/lib/toastStore";

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  // The page NEVER reloads on its own when a service worker activates: that
  // races the initial load on iOS Safari ("This page couldn't load" on every
  // later navigation). The only reload is the one the user triggers by
  // accepting an update banner, gated through this flag.
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

        // Check for updates periodically
        setInterval(() => {
          reg.update();
        }, 60 * 60 * 1000);

        // Listen for SW update
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

    // Reload ONLY when the user explicitly accepted an update (applyUpdate
    // set the flag). Uncontrolled SW activations (first install, deploy
    // updates) never reload the page: taking over mid-session on iOS Safari
    // breaks subsequent HTML navigations with "This page couldn't load".
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

  return { registration, isSupported, isRegistered, updateAvailable, applyUpdate };
}

export function usePushSubscription() {
  const { user } = useAuthStore();
  const { registration } = useServiceWorker();
  const [subscription, setSubscription] = useState<PushSubscriptionData | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  // Convert base64 VAPID key to Uint8Array
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

  // `silent` suppresses user-facing error toasts. Used by the automatic
  // subscribe-on-login flow, where a push-service failure (common on
  // localhost/dev, where the browser push service is unreachable) should not
  // spam the user with an error toast on every login.
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

    // Web Push only works in secure contexts (HTTPS or localhost). Catching
    // this early gives a human-readable message instead of the browser's
    // cryptic "Registration failed - push service error".
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

      // Send to backend
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
      // The browser refuses to register a subscription when the push service
      // is unreachable (FCM blocked, corporate network, offline) or when the
      // origin is not secure.
      if (err.name === "AbortError" || /push service|registration failed/i.test(err.message || "")) {
        // Chrome/FCM refuses push subscriptions for IP-address origins
        // (e.g. https://192.168.x.x) — only hostnames and localhost work.
        // A self-signed cert not trusted by this device has the same symptom.
        // Brave additionally disables the Google push service by default.
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

  // Check existing subscription on mount. Guard pushManager: iOS < 16.4 does
  // NOT expose ServiceWorkerRegistration.pushManager, and accessing it throws
  // "undefined is not an object" which crashed the root provider on every
  // visit (page never rendered for iPhone users). Web Push was never usable
  // there anyway (PushManager in window guard in subscribe()).
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
      if (standalone) {
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

// Extend Window interface for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
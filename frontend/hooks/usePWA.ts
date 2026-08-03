"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { toastInfo, toastError } from "@/lib/toastStore";

interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// Ensures the controllerchange handler reloads the page at most once, avoiding
// the PWA infinite-reload loop.
let reloadingForSW = false;

export function useServiceWorker() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const supported = "serviceWorker" in navigator;
    // Use setTimeout to avoid lint warning about sync setState in effect
    setTimeout(() => setIsSupported(supported), 0);

    if (!supported) return;

    // In production the SW is always registered. In development it is only
    // registered when NEXT_PUBLIC_ENABLE_SW=true (for PWA install/push testing
    // from a phone); otherwise we proactively unregister any SW left over from
    // a previous prod build / earlier dev session, so it stops controlling
    // this origin (a custom SW that caches /_next/* assets interferes with
    // Next.js dev HMR/Fast Refresh and caused an endless reload loop).
    if (process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_ENABLE_SW !== "true") {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => reg.unregister());
      });
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
        }, 60 * 60 * 1000); // Every hour
      })
      .catch((error) => {
        console.error("[SW] Registration failed:", error);
      });

    // Listen for controller change (new SW activated). Guard against the
    // classic PWA reload loop: the SW uses skipWaiting()+clients.claim(), which
    // makes controllerchange fire on the very first (uncontrolled) load — and
    // in dev, where sw.js is served fresh, it can fire on every load. An
    // unguarded window.location.reload() here then ping-pongs forever:
    // load -> claim -> controllerchange -> reload -> load -> ...
    //
    // A module-level flag only prevents duplicate reloads within a single page
    // load (it resets on reload), so it can't stop the cross-reload loop. We
    // use sessionStorage so the "already reloaded once" fact survives reloads:
    // we refresh at most once per tab session to pick up the new SW's assets,
    // then never again for the life of the tab.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloadingForSW) return;
      reloadingForSW = true;
      try {
        if (sessionStorage.getItem("sw-reloaded") === "1") return;
        sessionStorage.setItem("sw-reloaded", "1");
      } catch (error) {
        console.warn('sessionStorage unavailable (private mode?), skipping SW reload:', error);
        return;
      }
      console.log("[SW] Controller changed, reloading...");
      window.location.reload();
    });
  }, []);

  return { registration, isSupported, isRegistered };
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
  const subscribe = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!registration || !user) return;
    if (!("PushManager" in window)) {
      if (!silent) toastError("Notificaciones push no soportadas", new Error("PushManager not available"));
      return;
    }

    const swRegistration = registration;
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
      if (silent) {
        console.warn("Auto push subscribe failed (silenced):", error);
      } else {
        console.error("Subscribe error:", error);
        toastError("No se pudo activar push", error as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [registration, user, fetchVapidKey, urlBase64ToUint8Array]);

  const unsubscribe = useCallback(async () => {
    if (!subscription || !registration) return;

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

  // Check existing subscription on mount
  useEffect(() => {
    if (!registration) return;

    registration.pushManager.getSubscription().then((sub) => {
      if (sub) {
        setSubscription(sub.toJSON() as PushSubscriptionData);
        setIsSubscribed(true);
      }
    });
  }, [registration]);

  return { subscription, isSubscribed, loading, subscribe, unsubscribe };
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone) {
      setTimeout(() => setIsInstalled(true), 0);
      return;
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

  return { isInstallable, isInstalled, install };
}

// Extend Window interface for BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}
"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useServiceWorker, usePushSubscription } from "@/hooks/usePWA";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { isRegistered } = useServiceWorker();
  const { isSubscribed, subscribe } = usePushSubscription();

  // Auto-subscribe to push when user logs in (after SW registered).
  // Only attempt when the user has ALREADY granted notification permission:
  // we must not force a permission prompt on login, and a push-service failure
  // (common on localhost/dev) is silenced so it doesn't toast on every login.
  useEffect(() => {
    if (!isRegistered || !user || isSubscribed) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    // Small delay to ensure SW is fully ready
    const timer = setTimeout(() => {
      subscribe({ silent: true });
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRegistered, user, isSubscribed, subscribe]);

  // Handle push permission request on first visit (before login)
  // We don't auto-prompt here, we let the user decide via UI

  return <>{children}</>;
}
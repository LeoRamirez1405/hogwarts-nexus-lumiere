"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useServiceWorker, usePushSubscription } from "@/hooks/usePWA";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { isRegistered } = useServiceWorker();
  const { isSubscribed, subscribe } = usePushSubscription();

  // Auto-subscribe to push when user logs in (after SW registered)
  useEffect(() => {
    if (!isRegistered || !user || isSubscribed) return;

    // Small delay to ensure SW is fully ready
    const timer = setTimeout(() => {
      subscribe();
    }, 1000);

    return () => clearTimeout(timer);
  }, [isRegistered, user, isSubscribed, subscribe]);

  // Handle push permission request on first visit (before login)
  // We don't auto-prompt here, we let the user decide via UI

  return <>{children}</>;
}
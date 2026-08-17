"use client";

import { useEffect, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useServiceWorker, usePushSubscription } from "@/hooks/usePWA";

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  const { isRegistered } = useServiceWorker();
  const { isSubscribed } = usePushSubscription();

  // Track if we've already attempted initial subscription
  const attemptedRef = useRef(false);

  // Only sync existing subscription state on mount
  // Don't auto-subscribe - let useFCM handle permission + subscription flow
  useEffect(() => {
    if (!isRegistered || !user || isSubscribed || attemptedRef.current) return;

    attemptedRef.current = true;
    // Don't auto-subscribe silently - this conflicts with useFCM's flow
    // Users should grant permission via UI, then useFCM will get FCM token
    // and usePWA will sync subscription state via its useEffect
  }, [isRegistered, user, isSubscribed]);

  return <>{children}</>;
}
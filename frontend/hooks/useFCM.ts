"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAuthStore } from "@/lib/authStore";
import { toastInfo } from "@/lib/toastStore";

declare global {
  interface Window {
    Capacitor?: {
      isNativePlatform(): boolean;
    };
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Url);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  return btoa(String.fromCharCode(...bytes));
}

const firebaseConfig = {
  apiKey: "AIzaSyDJcEB8PnUA_7RyZEI9E-oGv5qRfRoX--U",
  authDomain: "nexus-13780.firebaseapp.com",
  projectId: "nexus-13780",
  storageBucket: "nexus-13780.firebasestorage.app",
  messagingSenderId: "22980815550",
  appId: "1:22980815550:web:de1854bf9b39e4bfa98cef",
  measurementId: "G-3LFFMR42JS"
};

let firebaseApp: ReturnType<(typeof import("firebase/app"))["initializeApp"]> | null = null;
let messaging: ReturnType<(typeof import("firebase/messaging"))["getMessaging"]> | null = null;

async function getFirebaseApp() {
  if (typeof window === "undefined") return null;
  if (!firebaseApp) {
    const { initializeApp } = await import("firebase/app");
    firebaseApp = initializeApp(firebaseConfig);
  }
  return firebaseApp;
}

async function getMessaging() {
  if (typeof window === "undefined") return null;
  if (!messaging) {
    const app = await getFirebaseApp();
    if (!app) return null;
    const { getMessaging: getMessagingFn } = await import("firebase/messaging");
    messaging = getMessagingFn(app);
  }
  return messaging;
}

interface PushNotificationData {
  url?: string;
  [key: string]: unknown;
}

interface CapacitorPushNotification {
  value: string;
}

interface CapacitorRegistrationError {
  error: string;
}

interface CapacitorPushNotificationReceived {
  data?: PushNotificationData;
}

interface CapacitorPushNotificationActionPerformed {
  notification?: {
    data?: PushNotificationData;
  };
}

export function useFCM() {
  const { user } = useAuthStore();
  const initializedRef = useRef(false);
  const listenersRef = useRef<Array<() => void>>([]);

const registerFCMToken = useCallback(async (token: string) => {
    if (!user) return;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }
    try {
      const res = await fetch(`${getApiBase()}/api/push/fcm-token`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          token,
          platform: "web",
          user_agent: navigator.userAgent
        })
      });
      if (!res.ok) {
        console.error("[FCM] Failed to register token:", res.status, await res.text());
      } else {
        console.log("[FCM] Token registered with backend");
      }
    } catch (error) {
      console.error("[FCM] Error registering token:", error);
    }
  }, [user]);

  const setupCapacitorPush = useCallback(async () => {
    if (typeof window === "undefined" || !window.Capacitor?.isNativePlatform()) {
      return;
    }

    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== "granted") {
      console.log("[FCM] Push permissions not granted");
      return;
    }

    const registrationListener = await PushNotifications.addListener(
      "registration",
      async (token: CapacitorPushNotification) => {
        console.log("[FCM] Capacitor registration token:", token.value);
        await registerFCMToken(token.value);
      }
    );

    const registrationErrorListener = await PushNotifications.addListener(
      "registrationError",
      (error: CapacitorRegistrationError) => {
        console.error("[FCM] Registration error:", error.error);
      }
    );

    const pushReceivedListener = await PushNotifications.addListener(
      "pushNotificationReceived",
      (notification: CapacitorPushNotificationReceived) => {
        console.log("[FCM] Push received in foreground:", notification);
        const title = (notification.data?.title as string) || "Nuevo mensaje";
        const body = (notification.data?.body as string) || "";
        toastInfo(title, body);
      }
    );

    const pushActionListener = await PushNotifications.addListener(
      "pushNotificationActionPerformed",
      (action: CapacitorPushNotificationActionPerformed) => {
        console.log("[FCM] Push action performed:", action);
        const url = action.notification?.data?.url;
        if (url && window.location.origin) {
          window.location.href = url;
        }
      }
    );

    listenersRef.current.push(
      () => registrationListener.remove(),
      () => registrationErrorListener.remove(),
      () => pushReceivedListener.remove(),
      () => pushActionListener.remove()
    );

    await PushNotifications.register();
  }, [registerFCMToken]);

  const setupFirebaseMessaging = useCallback(async () => {
    if (typeof window === "undefined") return;

    const { onMessage } = await import("firebase/messaging");
    const msg = await getMessaging();
    if (!msg) return;

    const unsubscribeForeground = onMessage(msg, (payload) => {
      console.log("[FCM] Foreground message (Web):", payload);
    });

    listenersRef.current.push(() => unsubscribeForeground());
  }, []);

  function getApiBase(): string {
  if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, "");
  }
  return "";
}

  const fetchVapidKey = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch(`${getApiBase()}/api/push/vapid-public-key`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.public_key;
    } catch (error) {
      console.error("[FCM] Failed to fetch VAPID key:", error);
      return null;
    }
  }, []);

  const requestWebPushPermission = useCallback(async () => {
    if (typeof window === "undefined" || window.Capacitor?.isNativePlatform()) return;

    if (!("Notification" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.log("[FCM] Web push permission not granted");
      return;
    }

    const { getToken } = await import("firebase/messaging");
    const msg = await getMessaging();
    if (!msg) return;

    try {
      const vapidKey = await fetchVapidKey();
      if (!vapidKey) {
        console.error("[FCM] No VAPID key available from backend");
        return;
      }
      console.log("[FCM] VAPID key (first 20 chars):", vapidKey.slice(0, 20) + "...");

      console.log("[FCM] Calling getToken...");
      const vapidKeyBytes = urlBase64ToUint8Array(vapidKey) as BufferSource;
      let token: string;
      let firebaseSW = await navigator.serviceWorker.getRegistration("/firebase-messaging-sw.js");
      if (!firebaseSW) {
        console.log("[FCM] Registering firebase-messaging-sw.js explicitly...");
        firebaseSW = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
      }
      try {
        token = await getToken(msg, { vapidKey, serviceWorkerRegistration: firebaseSW });
      } catch {
        console.warn("[FCM] Firebase getToken failed, trying direct subscription...");
        const sub = await firebaseSW.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyBytes,
        });
        const endpoint = sub.endpoint;
        const p256dh = bufferToBase64(sub.getKey("p256dh")!);
        const auth = bufferToBase64(sub.getKey("auth")!);
        token = `webpush_${endpoint}|${p256dh}|${auth}`;
      }
      console.log("[FCM] getToken returned:", token ? "SUCCESS" : "null/empty");
      if (token) {
        console.log("[FCM] Web push token:", token);
        await registerFCMToken(token);
      }
    } catch (error) {
      const err = error as Record<string, unknown>;
      console.error("[FCM] Full error:", JSON.stringify({
        name: err.name,
        message: err.message,
        code: err.code,
      }, null, 2));
      console.error("[FCM] Error getting web push token:", error);
    }
  }, [registerFCMToken, fetchVapidKey]);

  useEffect(() => {
    if (!user || initializedRef.current) return;
    initializedRef.current = true;

    const init = async () => {
      await getFirebaseApp();

      if (window.Capacitor?.isNativePlatform()) {
        await setupCapacitorPush();
      } else {
        await setupFirebaseMessaging();
        await requestWebPushPermission();
      }
    };

    init().catch(console.error);

    return () => {
      listenersRef.current.forEach((cleanup) => {
        try {
          cleanup();
        } catch (e) {
          console.warn("[FCM] Cleanup error:", e);
        }
      });
      listenersRef.current = [];
      initializedRef.current = false;
    };
  }, [user, setupCapacitorPush, setupFirebaseMessaging, requestWebPushPermission]);
}

export function useFCMInit() {
  useAuthStore();
  useFCM();
}
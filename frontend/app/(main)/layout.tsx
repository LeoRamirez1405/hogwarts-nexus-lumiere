"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { api } from "@/lib/api";
import { useFeatureFlagStore } from "@/lib/featureFlagStore";
import AppShell from "@/components/layout/AppShell";

export default function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, setAuth, isLoading } = useAuthStore();
  const loadFlags = useFeatureFlagStore((s) => s.load);
  const validatedRef = useRef(false);

  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;
    let cancelled = false;
    api
      .getMe()
      .then((u) => {
        if (!cancelled) setAuth(u);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router, setAuth]);

  useEffect(() => {
    if (user) {
      loadFlags();
    }
  }, [user, loadFlags]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface">
        <div className="text-center">
          <span className="material-symbols-outlined text-primary text-6xl mb-4 block animate-pulse">
            auto_stories
          </span>
          <p className="text-on-surface-variant font-body text-body-md">
            Cargando...
          </p>
        </div>
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}

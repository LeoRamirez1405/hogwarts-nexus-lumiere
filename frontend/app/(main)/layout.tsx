"use client";

import { useEffect } from "react";
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
  const { user, token, setAuth, setLoading, isLoading } = useAuthStore();
  const loadFlags = useFeatureFlagStore((s) => s.load);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken && !user) {
      api
        .getMe()
        .then((u) => setAuth(u, storedToken))
        .catch(() => {
          localStorage.removeItem("token");
          router.replace("/login");
        });
    } else if (!storedToken && !user) {
      router.replace("/login");
    } else {
      setLoading(false);
    }
  }, [user, token, setAuth, setLoading, router]);

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

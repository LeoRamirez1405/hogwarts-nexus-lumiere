"use client";

import { useEffect, useState } from "react";
import { api, DashboardData } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";
import { SkeletonCard, SkeletonLines, AdminDashboard, UserDashboard } from "@/components/domain/Dashboard";

export default function DashboardPage() {
  const { user } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .getDashboard()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar el panel");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
          <div className="h-4 bg-outline-variant/30 rounded w-1/4" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
        <GlassCard>
          <div className="p-6">
            <SkeletonLines count={4} />
          </div>
        </GlassCard>
      </div>
    );
  }

  if (error) {
    return (
      <GlassCard>
        <div className="p-12 text-center">
          <MaterialIcon name="error_outline" className="text-6xl text-error mb-4 block mx-auto" />
          <p className="text-on-surface text-title-md mb-2">Error al cargar el panel</p>
          <p className="text-on-surface-variant text-body-md">{error}</p>
        </div>
      </GlassCard>
    );
  }

  const isAdmin = user?.role === "admin";

  return (
    <div className="space-y-8">
      {isAdmin ? (
        <AdminDashboard data={data!} />
      ) : (
        <UserDashboard data={data!} />
      )}
    </div>
  );
}
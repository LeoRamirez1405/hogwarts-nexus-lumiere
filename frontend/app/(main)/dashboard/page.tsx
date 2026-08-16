"use client";

import { useQuery } from "@tanstack/react-query";
import { api, DashboardData } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useCallback } from "react";
import GlassCard from "@/components/ui/GlassCard";
import { Button, MaterialIcon } from "@/components/ui";
import { SkeletonCard, SkeletonLines, AdminDashboard, UserDashboard } from "@/components/domain/Dashboard";
import { toastError } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.getDashboard(),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  if (isLoading) {
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

  if (isError || !data) {
    return (
      <GlassCard>
        <div className="p-12 text-center">
          <MaterialIcon name="error_outline" className="text-6xl text-error mb-4 block mx-auto" />
          <p className="text-on-surface text-title-md mb-2">Error al cargar el panel</p>
          <p className="text-on-surface-variant text-body-md mb-6">
            {error instanceof Error ? error.message : "No se pudieron cargar los datos"}
          </p>
          <Button
            variant="primary"
            icon="refresh"
            onClick={() => {
              toastError("Error al cargar el panel", error);
              refetch();
            }}
            disabled={isFetching}
          >
            {isFetching ? "Reintentando..." : "Reintentar"}
          </Button>
        </div>
      </GlassCard>
    );
  }

  const isAdmin = user?.role === "admin";
  const dashboard: DashboardData = data;

return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-8 pb-8">
        {isAdmin ? (
          <AdminDashboard data={dashboard} />
        ) : (
          <UserDashboard data={dashboard} currentUserId={user?.id} />
        )}
      </div>
    </PullToRefresh>
  );
}

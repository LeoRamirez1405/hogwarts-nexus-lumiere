"use client";

import { DashboardData } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import { ZerineDisplay } from "@/components/ui";
import { TransactionList } from "./DashboardUtils";
import { PersonalStats } from "./PersonalStats";
import { QuickNav } from "./QuickNav";

interface UserDashboardProps {
  data: DashboardData;
}

export function UserDashboard({ data }: UserDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Personal Stats */}
      <PersonalStats data={data} />

      {/* Zerines Progress */}
      <GlassCard glow className="overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Progreso Zerines
            </span>
            <ZerineDisplay amount={data.zerines ?? 0} size="md" />
          </div>
          <div className="h-3 bg-surface-container-high rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${Math.min(((data.zerines ?? 0) / 10000) * 100, 100)}%` }}
            />
          </div>
          <p className="text-label-sm text-on-surface-variant mt-2 text-center">
            Objetivo: 10,000 Zerines
          </p>
        </div>
      </GlassCard>

      {/* Quick Nav */}
      <QuickNav />

      {/* Recent Activity */}
      <GlassCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-title-md text-on-surface">Actividad Reciente</h2>
            <span className="text-label-sm text-primary hover:underline cursor-pointer">Ver todo</span>
          </div>
          <TransactionList transactions={data.recent_transactions ?? []} limit={5} />
        </div>
      </GlassCard>
    </div>
  );
}
"use client";

import Link from "next/link";
import { DashboardData } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import { TransactionList } from "./DashboardUtils";
import { PersonalStats } from "./PersonalStats";
import { QuickNav } from "./QuickNav";

interface UserDashboardProps {
  data: DashboardData;
  currentUserId?: string;
}

export function UserDashboard({ data, currentUserId }: UserDashboardProps) {
  return (
    <div className="space-y-8">
      {/* Personal Stats */}
      <PersonalStats data={data} />

     
      {/* Quick Nav */}
      <QuickNav />

      {/* Recent Activity */}
      <GlassCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-title-md text-on-surface">Actividad Reciente</h2>
            <Link href="/treasury" className="text-label-sm text-primary hover:underline">Ver todo</Link>
          </div>
          <TransactionList transactions={data.recent_transactions ?? []} limit={5} currentUserId={currentUserId} />
        </div>
      </GlassCard>
    </div>
  );
}
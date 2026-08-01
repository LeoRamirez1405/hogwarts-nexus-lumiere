"use client";

import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";
import { formatAmount } from "../utils";

export interface WeeklyStats {
  totalDeposits: number;
  totalWithdrawals: number;
  totalTransfers: number;
}

export default function TransactionStats({ stats }: { stats: WeeklyStats }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <GlassCard glow>
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
            <MaterialIcon name="arrow_downward" className="text-2xl" />
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Depósitos (semana)
            </p>
            <p className="font-display text-title-md text-success">
              +{formatAmount(stats.totalDeposits)}
            </p>
          </div>
        </div>
      </GlassCard>
      <GlassCard glow>
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
            <MaterialIcon name="arrow_upward" className="text-2xl" />
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Retiros (semana)
            </p>
            <p className="font-display text-title-md text-error">
              -{formatAmount(stats.totalWithdrawals)}
            </p>
          </div>
        </div>
      </GlassCard>
      <GlassCard glow>
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <MaterialIcon name="swap_horiz" className="text-2xl" />
          </div>
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
              Transferencias (semana)
            </p>
            <p className="font-display text-title-md text-primary">
              {formatAmount(stats.totalTransfers)}
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
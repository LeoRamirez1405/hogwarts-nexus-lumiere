"use client";

import { DashboardData } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { formatAmount, TransactionList } from "./DashboardUtils";

function KPICard({ label, value, icon, bg, text }: {
  label: string;
  value: number;
  icon: string;
  bg: string;
  text: string;
}) {
  return (
    <GlassCard glow className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">
            {label}
          </span>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg} ${text}`}>
            <MaterialIcon name={icon} className="text-xl" />
          </div>
        </div>
        <p className="font-display text-headline-lg text-on-surface">
          {formatAmount(value)}
        </p>
      </div>
    </GlassCard>
  );
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const kpis = [
    { label: "Total Usuarios", value: data.total_users ?? 0, icon: "people", bg: "bg-primary", text: "text-on-primary" },
    { label: "Total Productos", value: data.total_products ?? 0, icon: "inventory_2", bg: "bg-secondary", text: "text-on-secondary" },
    { label: "Total Articulos", value: data.total_articles ?? 0, icon: "article", bg: "bg-tertiary", text: "text-on-tertiary" },
    { label: "Total Criaturas", value: data.total_creatures ?? 0, icon: "pets", bg: "bg-success", text: "text-on-success" },
    { label: "Total Zerines en Circulacion", value: data.total_zerines_in_circulation ?? 0, icon: "diamond", bg: "crystal-gradient inner-glow-gold", text: "text-on-primary" },
    { label: "Transacciones Recientes", value: data.recent_transactions?.length ?? 0, icon: "receipt_long", bg: "bg-surface-container", text: "text-on-surface" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <GlassCard>
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-title-md text-on-surface">
              Transacciones Recientes
            </h2>
            <Link href="/admin/transactions" className="text-label-sm text-primary hover:underline">
              Ver todas
            </Link>
          </div>
          <TransactionList transactions={data.recent_transactions ?? []} limit={5} />
        </div>
      </GlassCard>
    </div>
  );
}
"use client";

import { DashboardData } from "@/lib/api";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import GlassCard from "@/components/ui/GlassCard";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { formatAmount, TransactionList } from "./DashboardUtils";

const HOUSE_COLORS: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  Gryffindor: { bg: "bg-[#740001]", text: "text-[#d3a625]", border: "border-[#d3a625]/40", gradient: "from-[#740001] to-[#ae0001]" },
  Slytherin: { bg: "bg-[#1a472a]", text: "text-[#aaaaaa]", border: "border-[#aaaaaa]/40", gradient: "from-[#1a472a] to-[#2a623d]" },
  Ravenclaw: { bg: "bg-[#0e1a40]", text: "text-[#945bda]", border: "border-[#945bda]/40", gradient: "from-[#0e1a40] to-[#222f5b]" },
  Hufflepuff: { bg: "bg-[#ecb939]", text: "text-[#372e29]", border: "border-[#372e29]/40", gradient: "from-[#ecb939] to-[#f0c75e]" },
};

const MEDALS = ["🥇", "🥈", "🥉", ""];

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
        <div className="flex items-start justify-between mb-4 gap-2">
          <span className="text-label-sm text-on-surface-variant uppercase tracking-wider flex-1 min-w-0 pr-2">
            {label}
          </span>
          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bg} ${text} shrink-0 mt-0.5`}>
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

function HouseRankingCard({ houses }: { houses: { house: string; points: number }[] }) {
  if (!houses.length) return null;
  const maxPts = Math.max(...houses.map((h) => h.points), 1);

  return (
    <GlassCard glow className="overflow-hidden">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
            <MaterialIcon name="emoji_events" className="text-xl text-on-secondary" />
          </div>
          <div>
            <h3 className="font-display text-title-md text-on-surface">Casa Ganadora</h3>
            <p className="text-label-sm text-on-surface-variant">Puntos por casa este periodo</p>
          </div>
        </div>

        <div className="space-y-4">
          {houses.map((h, i) => {
            const colors = HOUSE_COLORS[h.house] || { bg: "bg-gray-400", text: "text-white", border: "border-gray", gradient: "from-gray-400 to-gray-500" };
            const pct = maxPts > 0 ? (h.points / maxPts) * 100 : 0;
            return (
              <div key={h.house} className="relative">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-title-md">{MEDALS[i] || ""}</span>
                    <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                    <span className="font-display text-body-md text-on-surface font-medium">{h.house}</span>
                  </div>
                  <span className="font-mono text-body-md text-on-surface font-bold">{h.points.toLocaleString()} pts</span>
                </div>
                <div className="w-full h-3 bg-surface-container-high rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full bg-linear-to-r ${colors.gradient} transition-all duration-700 ease-out`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

export function AdminDashboard({ data }: { data: DashboardData }) {
  const showWinningHouse = useFeatureFlag("dashboard.winning_house");

  const housePoints = data.house_points ?? {};
  const houseRanking = (() => {
    const allHouses = ["Gryffindor", "Slytherin", "Ravenclaw", "Hufflepuff"];
    const arr = allHouses.map((house) => ({ house, points: housePoints[house] ?? 0 }));
    arr.sort((a, b) => b.points - a.points);
    return arr;
  })();

  const kpis = [
    { label: "Usuarios", value: data.total_users ?? 0, icon: "people", bg: "bg-primary", text: "text-on-primary" },
    { label: "Productos", value: data.total_products ?? 0, icon: "inventory_2", bg: "bg-secondary", text: "text-on-secondary" },
    { label: "Artículos", value: data.total_articles ?? 0, icon: "article", bg: "bg-tertiary", text: "text-on-tertiary" },
    { label: "Criaturas", value: data.total_creatures ?? 0, icon: "pets", bg: "bg-success", text: "text-on-success" },
    { label: "Zerines en Circulacion", value: data.total_zerines_in_circulation ?? 0, icon: "diamond", bg: "crystal-gradient inner-glow-gold", text: "text-on-primary" },
    { label: "Canjes Semanales", value: data.recent_transactions?.length ?? 0, icon: "receipt_long", bg: "bg-surface-container", text: "text-on-surface" },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-6">
        {kpis.map((kpi) => (
          <KPICard key={kpi.label} {...kpi} />
        ))}
      </div>

      <div className={showWinningHouse ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : "grid grid-cols-1 gap-6"}>
        {showWinningHouse && <HouseRankingCard houses={houseRanking} />}

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
    </div>
  );
}
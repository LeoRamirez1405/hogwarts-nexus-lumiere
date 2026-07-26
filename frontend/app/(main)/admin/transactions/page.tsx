"use client";

import { useState, useEffect } from "react";
import { api, Transaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import SearchBar from "@/components/ui/SearchBar";
import Avatar from "@/components/ui/Avatar";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function formatAmount(amount: number) {
  return amount.toLocaleString();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txIcon(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return { icon: "arrow_downward", color: "bg-success/10 text-success" };
    case "withdrawal":
      return { icon: "arrow_upward", color: "bg-error/10 text-error" };
    case "transfer":
      return { icon: "swap_horiz", color: "bg-primary/10 text-primary" };
    case "purchase":
      return { icon: "shopping_cart", color: "bg-secondary/10 text-secondary" };
    default:
      return { icon: "receipt_long", color: "bg-surface-container-high text-on-surface-variant" };
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getActorName(tx: Transaction): string {
  if (tx.type === "deposit") {
    return tx.receiver?.name || tx.receiver_id ? "Desconocido" : "—";
  }
  if (tx.type === "withdrawal" || tx.type === "purchase") {
    return tx.sender?.name || tx.sender_id ? "Desconocido" : "—";
  }
  if (tx.type === "transfer") {
    return tx.sender?.name || tx.sender_id ? "Desconocido" : "—";
  }
  return "—";
}

function getActorAvatar(tx: Transaction): string | undefined {
  if (tx.type === "deposit") {
    return tx.receiver?.avatar_url;
  }
  return tx.sender?.avatar_url;
}

export default function AdminTransactionsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    api
      .getAllTransactionsAdmin()
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  const filtered = transactions.filter((tx) => {
    const actorName = getActorName(tx);
    const matchesSearch =
      !search ||
      tx.description?.toLowerCase().includes(search.toLowerCase()) ||
      actorName.toLowerCase().includes(search.toLowerCase()) ||
      tx.sender?.email?.toLowerCase().includes(search.toLowerCase()) ||
      tx.receiver?.email?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || tx.type === filter;
    return matchesSearch && matchesFilter;
  });

  const totalDeposits = transactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = transactions
    .filter((t) => t.type === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalTransfers = transactions
    .filter((t) => t.type === "transfer")
    .reduce((sum, t) => sum + t.amount, 0);

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Transacciones
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Historial completo de transacciones del sistema
          </p>
        </div>
        <div className="w-full md:w-80">
          <SearchBar
            placeholder="Buscar transacciones..."
            value={search}
            onChange={setSearch}
            size="md"
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard glow>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
              <MaterialIcon name="arrow_downward" className="text-2xl" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Depositos
              </p>
              <p className="font-display text-title-md text-success">
                +{formatAmount(totalDeposits)}
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
                Retiros
              </p>
              <p className="font-display text-title-md text-error">
                -{formatAmount(totalWithdrawals)}
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
                Transferencias
              </p>
              <p className="font-display text-title-md text-primary">
                {formatAmount(totalTransfers)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {["all", "deposit", "withdrawal", "transfer", "purchase"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
              filter === f
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {f === "all"
              ? "Todas"
              : f === "deposit"
                ? "Depositos"
                : f === "withdrawal"
                  ? "Retiros"
                  : f === "transfer"
                    ? "Transferencias"
                    : "Compras"}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-outline-variant/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-outline-variant/30 rounded w-1/3" />
                  <div className="h-3 bg-outline-variant/30 rounded w-1/4" />
                </div>
                <div className="h-5 bg-outline-variant/30 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <GlassCard>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/20">
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                    Tipo
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                    Usuario
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden sm:table-cell">
                    Fecha
                  </th>
                  <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right">
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const { icon, color } = txIcon(tx.type);
                  const isCredit = tx.type === "deposit" || (tx.type === "transfer" && tx.receiver_id);
                  return (
                    <tr
                      key={tx.id}
                      className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}
                          >
                            <MaterialIcon name={icon} className="text-lg" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-body-md text-on-surface capitalize">
                              {tx.type}
                            </p>
                            <p className="text-label-sm text-on-surface-variant md:hidden truncate max-w-[200px]">
                              {tx.description || "-"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <div className="flex items-center gap-2">
                          <Avatar
                            initials={getInitials(getActorName(tx))}
                            src={getActorAvatar(tx)}
                            size="sm"
                          />
                          <p className="text-body-md text-on-surface truncate max-w-[150px]">
                            {getActorName(tx)}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden sm:table-cell">
                        <p className="text-label-sm text-on-surface-variant">
                          {formatTime(tx.created_at)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p
                          className={`font-display text-title-md ${
                            isCredit ? "text-success" : "text-error"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {formatAmount(tx.amount)}
                        </p>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center">
                      <MaterialIcon
                        name="receipt_long"
                        className="text-5xl text-outline-variant mb-3 block mx-auto"
                      />
                      <p className="text-on-surface-variant text-body-md">
                        No hay transacciones
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

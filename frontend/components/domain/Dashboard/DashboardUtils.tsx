"use client";

import { Transaction } from "@/lib/api";
import { MaterialIcon, Skeleton } from "@/components/ui";

export function formatAmount(amount: number) {
  return amount.toLocaleString();
}

export function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface TransactionListProps {
  transactions: Transaction[];
  limit?: number;
  currentUserId?: string;
}

export function TransactionList({ transactions, limit = 5, currentUserId }: TransactionListProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-on-surface-variant text-body-md text-center py-8">
        No hay transacciones recientes
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.slice(0, limit).map((tx) => {
        const isCredit =
          tx.type === "deposit" ||
          (tx.type === "transfer" && tx.receiver_id === currentUserId);
        const prefix = isCredit ? "+" : "-";
        const colorClass = isCredit ? "text-success" : "text-error";
        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 py-3 border-b border-outline-variant/20 last:border-0"
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${
                tx.type === "deposit"
                  ? "bg-success/10 text-success"
                  : tx.type === "withdrawal"
                  ? "bg-error/10 text-error"
                  : "bg-primary/10 text-primary"
              }`}
            >
              <MaterialIcon
                name={
                  tx.type === "deposit"
                    ? "arrow_downward"
                    : tx.type === "withdrawal"
                    ? "arrow_upward"
                    : "swap_horiz"
                }
                className="text-xl"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md text-on-surface truncate">
                {tx.description || tx.type}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {formatTime(tx.created_at)}
              </p>
            </div>
            <div className="text-right shrink-0">
              <p className={`font-display text-title-md ${colorClass}`}>
                {prefix}{formatAmount(tx.amount)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <Skeleton variant="card" className={className} />;
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="table-row" />
      ))}
    </div>
  );
}
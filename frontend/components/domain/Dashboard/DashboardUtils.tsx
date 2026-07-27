"use client";

import { Transaction } from "@/lib/api";
import { MaterialIcon, ZerineDisplay } from "@/components/ui";

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
}

export function TransactionList({ transactions, limit = 5 }: TransactionListProps) {
  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-on-surface-variant text-body-md text-center py-8">
        No hay transacciones recientes
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {transactions.slice(0, limit).map((tx) => (
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
          <div className="text-right">
            <ZerineDisplay
              amount={tx.amount}
              variant={
                tx.type === "withdrawal" || tx.type === "purchase"
                  ? "delta"
                  : "price"
              }
              iconStyle="icon"
              size="md"
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-surface-container-high ${className}`}>
      <div className="p-6 space-y-3">
        <div className="h-4 bg-outline-variant/30 rounded w-1/2" />
        <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
      </div>
    </div>
  );
}

export function SkeletonLines({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="w-10 h-10 rounded-full bg-outline-variant/30" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
            <div className="h-3 bg-outline-variant/30 rounded w-1/2" />
          </div>
          <div className="h-4 bg-outline-variant/30 rounded w-16" />
        </div>
      ))}
    </div>
  );
}
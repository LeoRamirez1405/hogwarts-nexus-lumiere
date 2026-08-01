import { useMemo } from "react";
import { Transaction } from "@/lib/api";

export function useTransactionStats(transactions: Transaction[]) {
  return useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const weekTx = transactions.filter((t) => {
      const d = new Date(t.created_at);
      return d >= startOfWeek && d < endOfWeek;
    });

    return {
      totalDeposits: weekTx.filter((t) => t.type === "deposit").reduce((s, t) => s + t.amount, 0),
      totalWithdrawals: weekTx.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0),
      totalTransfers: weekTx.filter((t) => t.type === "transfer").reduce((s, t) => s + t.amount, 0),
    };
  }, [transactions]);
}
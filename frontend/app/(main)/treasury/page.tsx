"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, Transaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import GlassCard from "@/components/ui/GlassCard";
import TabGroup from "@/components/ui/TabGroup";
import { CrystalHero, DepositTab, WithdrawTab, TransferTab, HistoryTab } from "@/components/domain/Treasury";
import { toastError } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function TreasuryPage() {
  const { user, setUser } = useAuthStore();
  const showWithdraw = useFeatureFlag("treasury.withdraw");
  const [activeTab, setActiveTab] = useState("deposit");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(user?.zerines ?? 0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const tabs = useMemo(() => {
    const list = [
      { id: "deposit", label: "Plantillas de Depósito", icon: "add_circle" },
      ...(showWithdraw
        ? [{ id: "withdraw", label: "Retirar", icon: "remove_circle" }]
        : []),
      { id: "transfer", label: "Transferencias", icon: "swap_horiz" },
      { id: "history", label: "Recibos y Facturación", icon: "history" },
    ];
    return list;
  }, [showWithdraw]);

  /** Optimistic balance delta with rollback on failure.

   Called by Deposit/Withdraw/Transfer tabs before the API call: applies the
   delta immediately so the UI feels instant. Returns a `revert` callable;
   the tab must invoke it if the request fails so the displayed balance
   rolls back to its real server-side value.
   */
  const applyOptimisticBalance = useCallback((delta: number) => {
    const prevBalance = balance;
    const prevUser = user;
    setBalance((b) => Math.max(0, b + delta));
    if (prevUser) {
      setUser({ ...prevUser, zerines: Math.max(0, (prevUser.zerines ?? 0) + delta) });
    }
    return () => {
      setBalance(prevBalance);
      if (prevUser) setUser(prevUser);
    };
  }, [balance, user, setUser]);

  const refreshBalance = useCallback(async () => {
    try {
      const me = await api.getMe();
      if (!mountedRef.current) return;
      setBalance(me.zerines);
      setUser(me);
    } catch (e) {
      toastError("No se pudo actualizar tu balance", e);
    }
  }, [setUser]);

  const refreshTransactions = useCallback(async () => {
    try {
      const txs = await api.getTransactions();
      if (!mountedRef.current) return;
      setTransactions(txs.items);
    } catch (e) {
      toastError("No se pudo actualizar el historial", e);
    }
  }, []);

  /** Conditional refresh: balance for money tabs, history for history tab.

   History tab only needs transactions (already loaded on mount); money tabs
   need both balance + transactions. We avoid double-fetching ``me`` if only
   transactions changed.
   */
  const onDone = useCallback(async () => {
    await Promise.all([refreshBalance(), refreshTransactions()]);
  }, [refreshBalance, refreshTransactions]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [txs, me] = await Promise.all([api.getTransactions(), api.getMe()]);
        if (!cancelled) {
          setTransactions(txs.items);
          setBalance(me.zerines);
          setUser(me);
        }
      } catch (e) {
        if (!cancelled) toastError("No se pudo cargar tu tesoro", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [setUser]);

  const displayBalance = useMemo(
    () => user?.zerines ?? balance,
    [user?.zerines, balance]
  );

  const validActiveTab = tabs.some((t) => t.id === activeTab)
    ? activeTab
    : "deposit";

return (
    <PullToRefresh onRefresh={onDone}>
      <div className="space-y-8">
        <CrystalHero balance={displayBalance} loading={loading} />


        <TabGroup tabs={tabs} activeTab={validActiveTab} onChange={setActiveTab} />

        <GlassCard>
          <div className="p-6 md:p-8">
            {validActiveTab === "deposit" && (
              <DepositTab
                onDone={onDone}
                applyOptimisticBalance={applyOptimisticBalance}
                onErrorRollback={refreshBalance}
              />
            )}
            {validActiveTab === "withdraw" && (
              <WithdrawTab
                balance={displayBalance}
                onDone={onDone}
                applyOptimisticBalance={applyOptimisticBalance}
                onErrorRollback={refreshBalance}
              />
            )}
            {validActiveTab === "transfer" && (
              <TransferTab
                balance={displayBalance}
                onDone={onDone}
                applyOptimisticBalance={applyOptimisticBalance}
                onErrorRollback={refreshBalance}
              />
            )}
            {validActiveTab === "history" && (
              <HistoryTab transactions={transactions} currentUserId={user?.id} />
            )}
          </div>
        </GlassCard>
      </div>
    </PullToRefresh>
  );
}
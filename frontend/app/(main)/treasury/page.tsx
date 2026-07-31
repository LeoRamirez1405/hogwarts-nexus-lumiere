"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, Transaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlag } from "@/lib/featureFlagStore";
import GlassCard from "@/components/ui/GlassCard";
import TabGroup from "@/components/ui/TabGroup";
import { CrystalHero, DepositTab, WithdrawTab, TransferTab, HistoryTab } from "@/components/domain/Treasury";

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

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.getTransactions(), api.getMe()])
      .then(([txs, me]) => {
        if (!mountedRef.current) return;
        setTransactions(txs.items);
        setBalance(me.zerines);
        setUser(me);
      })
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [setUser]);

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
      } catch {
        // ignore
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
    <div className="space-y-8">
      <CrystalHero balance={displayBalance} loading={loading} />

      <TabGroup tabs={tabs} activeTab={validActiveTab} onChange={setActiveTab} />

      <GlassCard>
        <div className="p-6 md:p-8">
          {validActiveTab === "deposit" && <DepositTab onDone={refresh} />}
          {validActiveTab === "withdraw" && (
            <WithdrawTab balance={displayBalance} onDone={refresh} />
          )}
          {validActiveTab === "transfer" && <TransferTab balance={displayBalance} onDone={refresh} />}
          {validActiveTab === "history" && (
            <HistoryTab transactions={transactions} currentUserId={user?.id} />
          )}
       </div>
     </GlassCard>
   </div>
  );
}
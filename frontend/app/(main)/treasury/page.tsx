"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, Transaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import TabGroup from "@/components/ui/TabGroup";
import { CrystalHero, DepositTab, WithdrawTab, TransferTab, HistoryTab } from "@/components/domain/Treasury";

const tabs = [
  { id: "deposit", label: "Plantillas de Deposito", icon: "add_circle" },
  { id: "withdraw", label: "Retirar", icon: "remove_circle" },
  { id: "transfer", label: "Transferencias", icon: "swap_horiz" },
  { id: "history", label: "Recibos y Facturacion", icon: "history" },
];

export default function TreasuryPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("deposit");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(user?.zerines ?? 0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.getTransactions(), api.getMe()])
      .then(([txs, me]) => {
        if (!mountedRef.current) return;
        setTransactions(txs);
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
          setTransactions(txs);
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

  return (
    <div className="space-y-8">
      <CrystalHero balance={displayBalance} loading={loading} />

      <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <GlassCard>
        <div className="p-6 md:p-8">
          {activeTab === "deposit" && <DepositTab onDone={refresh} />}
          {activeTab === "withdraw" && (
            <WithdrawTab balance={displayBalance} onDone={refresh} />
          )}
          {activeTab === "transfer" && <TransferTab balance={displayBalance} onDone={refresh} />}
          {activeTab === "history" && (
            <HistoryTab transactions={transactions} />
          )}
       </div>
     </GlassCard>
   </div>
  );
}
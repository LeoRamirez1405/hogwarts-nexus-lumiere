"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import SearchBar from "@/components/ui/SearchBar";
import { useDebounce } from "@/hooks/useDebounce";
import { useTransactionFilters } from "./hooks/useTransactionFilters";
import { useTransactions } from "./hooks/useTransactions";
import { useTransactionStats } from "./hooks/useTransactionStats";
import TransactionStats from "./components/TransactionStats";
import TransactionFilters from "./components/TransactionFilters";
import TransactionCards from "./components/TransactionCards";
import TransactionsTable from "./components/TransactionsTable";
import AdminTransactionModal from "./components/AdminTransactionModal";
import PullToRefresh from "@/components/ui/PullToRefresh";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";

export default function AdminTransactionsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [txModalOpen, setTxModalOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const filters = useTransactionFilters();
  const txFilters = {
    ...filters.buildFilters(),
    search: debouncedSearch || undefined,
  };
  const { userData, adminData, isLoading, active } = useTransactions(txFilters, filters.activeTab, user?.role);
  const stats = useTransactionStats(adminData.items);

  const handleRefresh = useCallback(async () => {
    if (filters.activeTab === "user") {
      await adminData.refresh();
    } else {
      await adminData.refresh();
    }
  }, [filters.activeTab, adminData]);

  const handleCreated = useCallback(() => {
    void adminData.refresh();
    void userData.refresh();
  }, [adminData, userData]);

  const visibleTx = active.items;

  if (user?.role !== "admin") return null;

  const listFooterProps = {
    hasMore: active.hasMore,
    loading: active.loadingMore,
    pageSize: 15,
    loaded: active.totalLoaded,
    total: active.totalCount,
    onLoadMore: active.loadMore,
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
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
          <div className="flex items-center gap-2">
            <div className="w-full md:w-80">
              <SearchBar
                placeholder="Buscar transacciones..."
                value={search}
                onChange={setSearch}
                size="md"
              />
            </div>
            <div className="hidden md:block">
              <Button
                className="shrink-0"
                icon="add"
                onClick={() => setTxModalOpen(true)}
              >
                Nueva transacción
              </Button>
            </div>
          </div>
        </div>

        <div className="md:hidden">
          <Button
            className="w-full !py-2"
            icon="add"
            onClick={() => setTxModalOpen(true)}
          >
            Nueva transacción
          </Button>
        </div>

        <div className="flex gap-2">
          {(["user", "admin"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => filters.setActiveTab(tab)}
              className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                filters.activeTab === tab
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {tab === "user" ? "Mis transacciones" : "Todas las transacciones"}
            </button>
          ))}
        </div>

        <TransactionStats stats={stats} />
        <TransactionFilters {...filters} />

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} variant="table-row" />
            ))}
          </div>
        ) : (
          <>
            <TransactionCards txs={visibleTx} listFooterProps={listFooterProps} />
            <TransactionsTable txs={visibleTx} listFooterProps={listFooterProps} />
          </>
        )}
      </div>

      <AdminTransactionModal
        open={txModalOpen}
        onClose={() => setTxModalOpen(false)}
        onCreated={handleCreated}
      />
    </PullToRefresh>
  );
}
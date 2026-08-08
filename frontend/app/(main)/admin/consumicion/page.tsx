"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MaterialIcon } from "@/components/ui";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import TabGroup from "@/components/ui/TabGroup";
import ListFooter from "@/components/ui/ListFooter";
import PullToRefresh from "@/components/ui/PullToRefresh";
import { toastSuccess, toastError } from "@/lib/toastStore";
import { useAuthStore } from "@/lib/authStore";
import type { UserProductAdmin } from "@/lib/api";
import { useConsumicion } from "./hooks/useConsumicion";
import ConsumicionFilters from "./components/ConsumicionFilters";
import InventoryTable from "./components/InventoryTable";
import InventoryCards from "./components/InventoryCards";
import RemoveItemModal from "./components/RemoveItemModal";

const TABS = [
  { id: "flourish", label: "Flourish & Blotts", icon: "auto_stories" },
  { id: "borgin", label: "Borgin & Burkes", icon: "auto_fix_high" },
] as const;

export default function ConsumicionPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const {
    shop,
    setShop,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    clearFilters,
    items,
    hasMore,
    loading,
    loadingMore,
    error,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
    removeItem,
  } = useConsumicion();

  const [removeModalItem, setRemoveModalItem] = useState<UserProductAdmin | null>(null);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  if (user?.role !== "admin") {
    return null;
  }

  const handleRemoveClick = (item: UserProductAdmin) => {
    setRemoveModalItem(item);
  };

  const handleRemoveConfirm = async (quantity: number) => {
    if (!removeModalItem) return;
    try {
      await removeItem(removeModalItem.id, quantity);
      toastSuccess(
        quantity === removeModalItem.quantity
          ? "Elemento eliminado del inventario"
          : `${quantity} unidad${quantity > 1 ? "es" : ""} retirada${quantity > 1 ? "s" : ""} del inventario`
      );
      setRemoveModalItem(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : "Error al retirar del inventario");
    }
  };

  return (
    <PullToRefresh onRefresh={refresh}>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Consumición
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              Gestión de inventario consumido por los integrantes
            </p>
          </div>
        </div>

        <TabGroup
          tabs={TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))}
          activeTab={shop}
          onChange={(tabId) => setShop(tabId as "flourish" | "borgin")}
          variant="light"
        />

        <ConsumicionFilters
          search={search}
          onSearchChange={setSearch}
          dateFrom={dateFrom}
          onDateFromChange={setDateFrom}
          dateTo={dateTo}
          onDateToChange={setDateTo}
          onClearFilters={clearFilters}
        />

        {error && (
          <GlassCard variant="tinted" className="border-error/30 bg-error/5 p-4">
            <div className="flex items-center gap-2 text-error">
              <MaterialIcon name="error" className="text-lg" />
              <span className="text-body-md">{error}</span>
              <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
                Reintentar
              </Button>
            </div>
          </GlassCard>
        )}

        {!loading && !error && (
          <>
            <div className="hidden md:block">
              <InventoryTable
                items={items}
                onRemove={handleRemoveClick}
                loading={loadingMore}
              />
            </div>
            <div className="md:hidden">
              <InventoryCards
                items={items}
                onRemove={handleRemoveClick}
                loading={loadingMore}
              />
            </div>
            <ListFooter
              hasMore={hasMore}
              loading={loadingMore}
              pageSize={12}
              loaded={totalLoaded}
              total={totalCount}
              onLoadMore={loadMore}
            />
          </>
        )}

        {loading && (
          <div className="space-y-4" aria-busy="true">
            {[1, 2, 3].map((i) => (
              <GlassCard key={i} className="animate-pulse">
                <div className="h-20 bg-surface-container-high rounded-lg" />
              </GlassCard>
            ))}
          </div>
        )}
      </div>

      <RemoveItemModal
        open={!!removeModalItem}
        onClose={() => setRemoveModalItem(null)}
        onConfirm={handleRemoveConfirm}
        item={removeModalItem}
        loading={loadingMore}
      />
    </PullToRefresh>
  );
}
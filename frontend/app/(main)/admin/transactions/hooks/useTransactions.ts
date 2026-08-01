"use client";

import { api, User } from "@/lib/api";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import type { TransactionFilters, TabType } from "../types";

export function useTransactions(
  filters: TransactionFilters,
  activeTab: TabType,
  userRole: User["role"] | undefined
) {
  const userData = usePaginatedList({
    fetcher: (p) => api.getTransactions(p, filters),
    pageSize: 15,
    enabled: true,
    queryKey: ["admin-transactions-user"],
    resetKey: [filters.type, activeTab, filters.userId, filters.dateFrom, filters.dateTo],
  });

  const adminData = usePaginatedList({
    fetcher: (p) => api.getAllTransactionsAdmin(p, filters),
    pageSize: 15,
    enabled: userRole === "admin" && activeTab === "admin",
    queryKey: ["admin-transactions-all"],
    resetKey: [filters.type, activeTab, filters.userId, filters.dateFrom, filters.dateTo],
  });

  const isLoading = activeTab === "user" ? userData.loading : adminData.loading;
  const active = activeTab === "user" ? userData : adminData;

  return {
    userData,
    adminData,
    isLoading,
    active,
  };
}
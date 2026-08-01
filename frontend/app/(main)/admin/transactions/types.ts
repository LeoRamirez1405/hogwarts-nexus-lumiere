"use client";

import { Transaction } from "@/lib/api";

export type TabType = "user" | "admin";

export type TxTypeFilter = "all" | Transaction["type"];

export interface TransactionFilters {
  type: string | undefined;
  userId: string | undefined;
  dateFrom: string | undefined;
  dateTo: string | undefined;
}

export interface ListFooterProps {
  hasMore: boolean;
  loading: boolean;
  pageSize: number;
  loaded: number;
  total: number;
  onLoadMore: () => void;
}
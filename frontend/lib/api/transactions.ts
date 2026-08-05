import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";
import type { User } from "./users";

export interface Transaction {
  id: string;
  sender_id?: string;
  receiver_id?: string;
  sender?: User;
  receiver?: User;
  amount: number;
  type: "deposit" | "withdrawal" | "transfer" | "purchase";
  description: string;
  status: "pending" | "confirmed" | "completed";
  created_at: string;
}

export const transactionsApi = {
  getTransactions: (
    pagination?: PaginationParams,
    filters?: {
      type?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) =>
    request<Page<Transaction>>(
      "/transactions/" +
        buildQuery({
          type: filters?.type,
          user_id: filters?.userId,
          date_from: filters?.dateFrom,
          date_to: filters?.dateTo,
          ...(pagination ?? {}),
        })
    ),

  getAllTransactionsAdmin: (
    pagination?: PaginationParams,
    filters?: {
      type?: string;
      userId?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ) =>
    request<Page<Transaction>>(
      "/admin/transactions/" +
        buildQuery({
          type: filters?.type,
          user_id: filters?.userId,
          date_from: filters?.dateFrom,
          date_to: filters?.dateTo,
          ...(pagination ?? {}),
        })
    ),

  deposit: (amount: number, description?: string) =>
    request<Transaction>("/transactions/deposit", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    }),

  withdraw: (amount: number, description?: string) =>
    request<Transaction>("/transactions/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount, description }),
    }),

  transfer: (receiver_id: string, amount: number, description?: string) =>
    request<Transaction>("/transactions/transfer", {
      method: "POST",
      body: JSON.stringify({ receiver_id, amount, description }),
    }),
};
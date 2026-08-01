import { request } from "../core";
import type { Transaction } from "../transactions";

export interface DashboardData {
  total_users?: number;
  total_products?: number;
  total_articles?: number;
  total_creatures?: number;
  total_zerines_in_circulation?: number;
  house_points?: Record<string, number>;
  recent_transactions?: Transaction[];
  zerines?: number;
  my_creatures?: number;
  my_posts?: number;
  total_likes_received?: number;
  unread_messages?: number;
}

export const dashboardApi = {
  getDashboard: () => request<DashboardData>("/dashboard/"),
};
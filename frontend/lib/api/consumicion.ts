import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";
import type { Product } from "./products";

export interface UserBrief {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  house?: string;
}

export interface UserProductAdmin {
  id: string;
  user_id: string;
  user: UserBrief;
  product_id: string;
  product: Product;
  quantity: number;
  specification?: string;
  purchased_at: string;
}

export interface InventoryRemoveRequest {
  quantity: number;
}

export interface InventoryRemoveResponse {
  success: boolean;
  removed_quantity: number;
  remaining_quantity: number;
  deleted: boolean;
}

export const consumicionApi = {
  getInventory: (
    shop?: string,
    search?: string,
    dateFrom?: string,
    dateTo?: string,
    pagination?: PaginationParams
  ) =>
    request<Page<UserProductAdmin>>(
      `/admin/inventory/${buildQuery({
        shop,
        search,
        date_from: dateFrom,
        date_to: dateTo,
        ...(pagination ?? {}),
      })}`
    ),

  removeInventoryItem: (userProductId: string, quantity: number) =>
    request<InventoryRemoveResponse>(`/admin/inventory/${userProductId}/remove`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    }),
};
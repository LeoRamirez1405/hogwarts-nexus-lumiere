import { request, buildQuery } from "../core";
import type { PaginationParams, Page } from "../core";

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  shop: "borgin" | "flourish";
  image_url?: string;
  stock: number;
  weekly_sales?: number;
  created_at: string;
}

export interface UserProduct {
  id: string;
  user_id: string;
  product_id: string;
  product?: Product;
  quantity: number;
  purchased_at: string;
}

export interface BatchPurchaseItemResult {
  product_id: string;
  name: string;
  quantity: number;
  price: number;
  status: string;
  error?: string;
}

export interface BatchPurchaseResult {
  success: boolean;
  purchased: BatchPurchaseItemResult[];
  total_spent: number;
  new_balance: number;
}

export const productsApi = {
  getProducts: (shop?: string, pagination?: PaginationParams, category?: string) =>
    request<Page<Product>>(
      `/products/${buildQuery({ shop, category, ...(pagination ?? {}) })}`
    ),

  getProduct: (id: string) => request<Product>(`/products/${id}`),

  getPopularProducts: (shop: string, limit?: number) =>
    request<Product[]>(
      `/products/popular/${shop}${limit ? `?limit=${limit}` : ""}`
    ),

  purchaseProduct: (id: string, quantity?: number) =>
    request<Product>(`/products/${id}/purchase`, {
      method: "POST",
      body: JSON.stringify({ quantity: quantity || 1 }),
    }),

  batchPurchase: (items: { product_id: string; quantity: number }[]) =>
    request<BatchPurchaseResult>("/products/batch-purchase", {
      method: "POST",
      body: JSON.stringify({ items }),
    }),

  getMyPurchases: (pagination?: PaginationParams) =>
    request<Page<UserProduct>>(
      "/products/my-purchases" + buildQuery(pagination ?? {})
    ),

  createProduct: (data: Partial<Product>) =>
    request<Product>("/products/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProduct: (id: string, data: Partial<Product>) =>
    request<Product>(`/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteProduct: (id: string) =>
    request<void>(`/products/${id}`, { method: "DELETE" }),
};
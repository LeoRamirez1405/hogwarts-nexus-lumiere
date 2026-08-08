import { request, buildQuery } from "./core";
import type { PaginationParams, Page } from "./core";

export interface Catalog {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  item_count: number;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  catalog_id: string;
  numero: number;
  description?: string;
  image_url?: string;
  is_favorite: boolean;
  created_at: string;
}

export interface CatalogInput {
  name?: string;
  description?: string | null;
  cover_image_url?: string | null;
}

export interface CatalogItemInput {
  description?: string | null;
  image_url?: string | null;
}

export const catalogsApi = {
  getCatalogs: (pagination?: PaginationParams, search?: string) =>
    request<Page<Catalog>>(
      "/catalogs/" + buildQuery({ search, ...(pagination ?? {}) })
    ),

  getCatalog: (id: string) => request<Catalog>(`/catalogs/${id}`),

  getCatalogItems: (
    catalogId: string,
    pagination?: PaginationParams,
    onlyFavorites?: boolean
  ) =>
    request<Page<CatalogItem>>(
      `/catalogs/${catalogId}/items${buildQuery({
        ...(pagination ?? {}),
        ...(onlyFavorites ? { only_favorites: "true" as string } : {}),
      })}`
    ),

  toggleItemFavorite: (itemId: string) =>
    request<CatalogItem>(`/catalogs/items/${itemId}/favorite`, {
      method: "POST",
    }),

  createCatalog: (data: CatalogInput) =>
    request<Catalog>("/admin/catalogs/", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCatalog: (id: string, data: CatalogInput) =>
    request<Catalog>(`/admin/catalogs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCatalog: (id: string) =>
    request<void>(`/admin/catalogs/${id}`, { method: "DELETE" }),

  getCatalogItemsAdmin: (
    catalogId: string,
    pagination?: PaginationParams,
    search?: string
  ) =>
    request<Page<CatalogItem>>(
      `/admin/catalogs/${catalogId}/items${buildQuery({
        search,
        ...(pagination ?? {}),
      })}`
    ),

  createCatalogItem: (catalogId: string, data: CatalogItemInput) =>
    request<CatalogItem>(`/admin/catalogs/${catalogId}/items`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateCatalogItem: (itemId: string, data: CatalogItemInput) =>
    request<CatalogItem>(`/admin/catalogs/items/${itemId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteCatalogItem: (itemId: string) =>
    request<void>(`/admin/catalogs/items/${itemId}`, { method: "DELETE" }),
};

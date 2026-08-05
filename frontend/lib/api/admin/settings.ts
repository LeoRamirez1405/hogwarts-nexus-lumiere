import { request, buildQuery } from "../core";
import type { PaginationParams, Page } from "../core";

export interface EnumValue {
  id: string;
  category_id: string;
  label: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface EnumCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  is_system: boolean;
  created_at: string;
  values: EnumValue[];
}

export interface EnumCategoryCreate {
  code: string;
  name: string;
  description?: string;
}

export interface EnumCategoryUpdate {
  name?: string;
  description?: string;
}

export interface EnumValueCreate {
  label: string;
  description?: string;
}

export interface EnumValueUpdate {
  label?: string;
  description?: string;
}

export interface FeatureFlag {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  category?: string;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlagCreate {
  key: string;
  name: string;
  description?: string;
  enabled?: boolean;
  category?: string;
}

export interface FeatureFlagUpdate {
  name?: string;
  description?: string;
  enabled?: boolean;
  category?: string;
}

export const enumTypesApi = {
  getEnumCategories: (pagination?: PaginationParams) =>
    request<Page<EnumCategory>>(
      "/enum-types/categories" + buildQuery(pagination ?? {})
    ),

  getEnumCategory: (id: string) =>
    request<EnumCategory>(`/enum-types/categories/${id}`),

  getEnumCategoryByCode: (code: string) =>
    request<EnumCategory>(`/enum-types/categories/code/${code}`),

  createEnumCategory: (data: EnumCategoryCreate) =>
    request<EnumCategory>("/admin/enums/categories", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEnumCategory: (id: string, data: EnumCategoryUpdate) =>
    request<EnumCategory>(`/admin/enums/categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteEnumCategory: (id: string) =>
    request<void>(`/admin/enums/categories/${id}`, { method: "DELETE" }),

  getEnumValues: (categoryId: string) =>
    request<EnumValue[]>(`/enum-types/categories/${categoryId}/values`),

  createEnumValue: (categoryId: string, data: EnumValueCreate) =>
    request<EnumValue>(`/admin/enums/categories/${categoryId}/values`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateEnumValue: (valueId: string, data: EnumValueUpdate) =>
    request<EnumValue>(`/admin/enums/values/${valueId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteEnumValue: (valueId: string) =>
    request<void>(`/admin/enums/values/${valueId}`, { method: "DELETE" }),
};

export const featureFlagsApi = {
  getFeatureFlags: (showHidden?: boolean) =>
    request<{ items: FeatureFlag[]; total: number }>(`/feature-flags${showHidden ? "?show_hidden=true" : ""}`),

  getFeatureFlag: (key: string) =>
    request<FeatureFlag>(`/feature-flags/${key}`),

  createFeatureFlag: (data: FeatureFlagCreate) =>
    request<FeatureFlag>("/admin/feature-flags", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateFeatureFlag: (key: string, data: FeatureFlagUpdate) =>
    request<FeatureFlag>(`/admin/feature-flags/${key}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteFeatureFlag: (key: string) =>
    request<void>(`/admin/feature-flags/${key}`, { method: "DELETE" }),
};
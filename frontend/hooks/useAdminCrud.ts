"use client";

import { useState, useCallback } from "react";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { useDebounce } from "@/hooks/useDebounce";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

export interface AdminCrudConfig<T, TCreate, TUpdate> {
  /** React Query key for this list */
  queryKey: string[];
  /** Fetcher for paginated list */
  fetcher: (pagination: { skip: number; limit: number }) => Promise<{ items: T[]; total: number; has_more: boolean; skip: number; limit: number }>;
  /** Create API call */
  createFn: (data: TCreate) => Promise<T>;
  /** Update API call */
  updateFn: (id: string, data: TUpdate) => Promise<T>;
  /** Delete API call */
  deleteFn: (id: string) => Promise<void>;
  /** Get display name for an item (used in confirm dialogs) */
  getDisplayName: (item: T) => string;
  /** Get unique ID for an item */
  getId: (item: T) => string;
  /** Page size */
  pageSize?: number;
  /** Whether to enable the list */
  enabled?: boolean;
  /** Key that resets pagination when changed (e.g., filter) */
  resetKey?: unknown;
  /** Success messages */
  messages?: {
    create?: string;
    update?: string;
    delete?: string;
  };
  /** Client-side filter function */
  filterFn?: (item: T, search: string) => boolean;
  /** Default create form state */
  defaultCreateForm?: TCreate;
}

export interface AdminCrudState<T, TCreate> {
  // List state
  items: T[];
  filteredItems: T[];
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  totalLoaded: number;
  totalCount: number;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  error: string | null;

  // Search
  search: string;
  setSearch: (v: string) => void;
  debouncedSearch: string;

  // Create modal
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  creating: boolean;
  setCreating: (v: boolean) => void;
  createForm: TCreate | null;
  setCreateForm: (form: TCreate | ((prev: TCreate | null) => TCreate)) => void;

  // Edit modal
  editItem: T | null;
  setEditItem: (item: T | null) => void;
  saving: boolean;
  setSaving: (v: boolean) => void;

  // Delete
  handleDelete: (id: string) => void;

  // Form handlers (to be implemented by consumer)
  // handleCreate: (data: TCreate) => Promise<void>;
  // handleSave: (id: string, data: TUpdate) => Promise<void>;
}

export function useAdminCrud<T, TCreate, TUpdate>(config: AdminCrudConfig<T, TCreate, TUpdate>): AdminCrudState<T, TCreate> & {
  handleCreate: (data: TCreate) => Promise<void>;
  handleSave: (id: string, data: TUpdate) => Promise<void>;
} {
  const {
    queryKey,
    fetcher,
    createFn,
    updateFn,
    deleteFn,
    getDisplayName,
    getId,
    pageSize = 12,
    enabled = true,
    resetKey,
    messages = {},
    filterFn,
    defaultCreateForm,
  } = config;

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editItem, setEditItem] = useState<T | null>(null);
  const [saving, setSaving] = useState(false);
  const [createForm, setCreateForm] = useState<TCreate | null>(defaultCreateForm ?? null);

  const {
    items: allItems,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
    error,
  } = usePaginatedList({
    fetcher,
    pageSize,
    enabled,
    queryKey,
    resetKey,
  });

  const filteredItems = allItems.filter((item) =>
    filterFn ? filterFn(item, debouncedSearch) : true
  );

  const handleCreate = useCallback(
    async (data: TCreate) => {
      try {
        await createFn(data);
        setShowCreate(false);
        toastSuccess(messages.create ?? "Creado exitosamente");
        await refresh();
      } catch (e) {
        toastError("No se pudo crear", e);
        throw e;
      }
    },
    [createFn, messages.create, refresh]
  );

  const handleSave = useCallback(
    async (id: string, data: TUpdate) => {
      setSaving(true);
      try {
        await updateFn(id, data);
        setEditItem(null);
        toastSuccess(messages.update ?? "Actualizado exitosamente");
        await refresh();
      } catch (e) {
        toastError("No se pudo actualizar", e);
        throw e;
      } finally {
        setSaving(false);
      }
    },
    [updateFn, messages.update, refresh]
  );

  const handleDelete = useCallback(
    (id: string) => {
      const item = allItems.find((i) => getId(i) === id);
      const name = item ? getDisplayName(item) : "este elemento";
      confirmDialog({
        title: "Eliminar?",
        message: `Se eliminará "${name}". Esta acción no se puede deshacer.`,
        variant: "danger",
        icon: "delete",
        onConfirm: async () => {
          try {
            await deleteFn(id);
            toastSuccess(messages.delete ?? "Eliminado exitosamente");
            await refresh();
          } catch (e) {
            toastError("No se pudo eliminar", e);
          }
        },
      });
    },
    [allItems, getDisplayName, getId, deleteFn, messages.delete, refresh]
  );

  return {
    // List
    items: allItems,
    filteredItems,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
    error,
    // Search
    search,
    setSearch,
    debouncedSearch,
    // Create
    showCreate,
    setShowCreate,
    creating,
    setCreating,
    createForm,
    setCreateForm,
    // Edit
    editItem,
    setEditItem,
    saving,
    setSaving,
    // Actions
    handleCreate,
    handleSave,
    handleDelete,
  };
}
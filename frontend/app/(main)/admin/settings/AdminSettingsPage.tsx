"use client";

import { useState, useEffect } from "react";
import { api, EnumCategory, EnumValue } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { useFeatureFlags } from "./hooks/useFeatureFlags";
import { FeatureFlagsCard } from "./components/FeatureFlagsCard";
import { NotificationPrefsCard } from "./components/NotificationPrefsCard";
import { CategoriesSidebar } from "./components/CategoriesSidebar";
import { ValuesPanel } from "./components/ValuesPanel";
import { CategoryModal, type CategoryForm } from "./components/CategoryModal";
import { ValueModal, type ValueForm } from "./components/ValueModal";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function AdminSettingsPage() {
  const { user, setUser } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { flags, flagsLoading, flagUpdating, toggleFlag } = useFeatureFlags();
  const [notifUpdating, setNotifUpdating] = useState(false);

  const crud = useAdminCrud<EnumCategory, { code: string; name: string; description?: string }, { code?: string; name: string; description?: string }>({
    queryKey: ["admin-enum-categories"],
    fetcher: async (p) => {
      const cats = await api.getEnumCategories(p);
      return cats;
    },
    createFn: (data) => api.createEnumCategory(data),
    updateFn: (id, data) => api.updateEnumCategory(id, data),
    deleteFn: (id) => api.deleteEnumCategory(id),
    getDisplayName: (c) => c.name,
    getId: (c) => c.id,
    pageSize: 10,
    enabled: true,
    defaultCreateForm: { code: "", name: "", description: "" },
    messages: {
      create: "Categoría creada",
      update: "Categoría actualizada",
      delete: "Categoría eliminada",
    },
  });

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Create/Edit Category
  const [catForm, setCatForm] = useState<CategoryForm>({ code: "", name: "", description: "" });
  const [savingCategory, setSavingCategory] = useState(false);

  // Create/Edit Value
  const [editValue, setEditValue] = useState<EnumValue | null>(null);
  const [isNewValue, setIsNewValue] = useState(false);
  const [valForm, setValForm] = useState<ValueForm>({ label: "", description: "" });
  const [savingValue, setSavingValue] = useState(false);

  // Derive the effectively active category id
  const effectiveActiveId =
    activeCategoryId && crud.items.some((c) => c.id === activeCategoryId)
      ? activeCategoryId
      : crud.items.length > 0
      ? crud.items[0].id
      : null;
  const activeCategory = crud.items.find((c) => c.id === effectiveActiveId);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleToggleMarketplaceNotifications = async (enabled: boolean) => {
    if (!user) return;
    setNotifUpdating(true);
    try {
      const updated = await api.updateUser(user.id, { receive_marketplace_notifications: enabled });
      setUser(updated);
    } finally {
      setNotifUpdating(false);
    }
  };

  const openNewCategory = () => {    setCatForm({ code: "", name: "", description: "" });
    crud.setShowCreate(true);
  };

  const handleSaveCategory = async () => {
    setSavingCategory(true);
    try {
      const data = {
        code: catForm.code,
        name: catForm.name,
        description: catForm.description || undefined,
      };
      if (crud.showCreate) {
        await crud.handleCreate(data);
        await crud.refresh();
        const newCat = crud.items.find(c => c.code === catForm.code);
        if (newCat) setActiveCategoryId(newCat.id);
      } else if (crud.editItem) {
        await crud.handleSave(crud.editItem.id, data);
      }
      setCatForm({ code: "", name: "", description: "" });
      crud.setShowCreate(false);
      crud.setEditItem(null);
      toastSuccess(crud.showCreate ? "Categoría creada" : "Categoría actualizada");
    } catch (e) {
      toastError(
        crud.showCreate ? "No se pudo crear la categoría" : "No se pudo actualizar la categoría",
        e
      );
    }
    setSavingCategory(false);
  };

  const openNewValue = () => {
    if (!effectiveActiveId) return;
    setIsNewValue(true);
    setEditValue(null);
    setValForm({ label: "", description: "" });
  };

  const openEditValue = (v: EnumValue) => {
    setIsNewValue(false);
    setEditValue(v);
    setValForm({
      label: v.label,
      description: v.description || "",
    });
  };

  const handleSaveValue = async () => {
    if (!effectiveActiveId) return;
    setSavingValue(true);
    try {
      const data = {
        label: valForm.label,
        description: valForm.description || undefined,
      };
      if (isNewValue) {
        await api.createEnumValue(effectiveActiveId, data);
      } else if (editValue) {
        await api.updateEnumValue(editValue.id, data);
      }
      await crud.refresh();
      setEditValue(null);
      setIsNewValue(false);
      toastSuccess(isNewValue ? "Valor creado" : "Valor actualizado");
    } catch (e) {
      toastError(
        isNewValue ? "No se pudo crear el valor" : "No se pudo actualizar el valor",
        e
      );
    }
    setSavingValue(false);
  };

  const handleDeleteValue = (valueId: string) => {
    confirmDialog({
      title: "Eliminar valor?",
      message: "Esta acción no se puede deshacer.",
      variant: "danger",
      icon: "delete",
      onConfirm: async () => {
        try {
          await api.deleteEnumValue(valueId);
          await crud.refresh();
          toastSuccess("Valor eliminado");
        } catch (e) {
          toastError("No se pudo eliminar el valor", e);
        }
      },
    });
  };

  if (user?.role !== "admin") return null;

  return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1 text-label-sm text-on-surface-variant hover:text-primary transition-colors mb-2"
            >
              <MaterialIcon name="arrow_back" className="text-[1.1em]" />
              Volver
            </Link>
            <h1 className="font-display text-headline-lg text-on-surface">Configuración del Sistema</h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              Gestiona tipos, categorías y valores del sistema
            </p>
          </div>
        </div>

        {/* Feature Flags section */}
        <FeatureFlagsCard
          flags={flags}
          loading={flagsLoading}
          updatingKey={flagUpdating}
          onToggle={toggleFlag}
        />

        {/* Notification preferences */}
        <NotificationPrefsCard
          enabled={user?.receive_marketplace_notifications ?? true}
          updating={notifUpdating}
          onToggle={handleToggleMarketplaceNotifications}
        />

        {crud.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Sidebar - Categories */}
            <CategoriesSidebar
              items={crud.filteredItems}
              activeId={effectiveActiveId}
              search={search}
              onSearchChange={setSearch}
              onSelect={setActiveCategoryId}
              onNew={openNewCategory}
              hasMore={crud.hasMore}
              loadingMore={crud.loadingMore}
              totalLoaded={crud.totalLoaded}
              totalCount={crud.totalCount}
              onLoadMore={crud.loadMore}
            />

            {/* Main - Values */}
            <ValuesPanel
              category={activeCategory ?? null}
              onNewValue={openNewValue}
              onEditValue={openEditValue}
              onDeleteValue={handleDeleteValue}
            />
          </div>
        )}

        {/* Edit Category Modal */}
        <CategoryModal
          open={Boolean(crud.editItem || crud.showCreate)}
          isCreate={crud.showCreate}
          form={catForm}
          onFormChange={setCatForm}
          saving={crud.saving || crud.creating || savingCategory}
          onSave={handleSaveCategory}
          onClose={() => { crud.setEditItem(null); crud.setShowCreate(false); }}
        />

        {/* Edit Value Modal */}
        <ValueModal
          open={Boolean(editValue || isNewValue)}
          isNew={isNewValue}
          form={valForm}
          onFormChange={setValForm}
          saving={savingValue}
          onSave={handleSaveValue}
          onClose={() => { setEditValue(null); setIsNewValue(false); }}
        />
      </div>
    </PullToRefresh>
  );
}

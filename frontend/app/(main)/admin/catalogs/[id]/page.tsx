"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, CatalogItem, CatalogItemInput } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField, TextareaField } from "@/components/ui/AdminCrudModal";
import { useUnsavedChangesGuard, useFormDirtyState } from "@/hooks/useUnsavedChangesGuard";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function AdminCatalogItemsPage() {
  const params = useParams<{ id: string }>();
  const catalogId = params.id;
  const router = useRouter();
  const { user } = useAuthStore();

  const [form, setForm] = useState<{ description: string; image_url: string }>({
    description: "",
    image_url: "",
  });

  const initialFormState = useMemo(
    () => ({ description: "", image_url: "" }),
    []
  );

  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["catalog", catalogId],
    queryFn: () => api.getCatalog(catalogId),
    enabled: !!catalogId,
  });

  const crud = useAdminCrud<CatalogItem, CatalogItemInput, CatalogItemInput>({
    queryKey: ["admin-catalog-items", catalogId],
    fetcher: (p) => api.getCatalogItemsAdmin(catalogId, p),
    createFn: (data) => api.createCatalogItem(catalogId, data),
    updateFn: (id, data) => api.updateCatalogItem(id, data),
    deleteFn: (id) => api.deleteCatalogItem(id),
    getDisplayName: (i) => `Elemento #${i.numero}`,
    getId: (i) => i.id,
    pageSize: 12,
    enabled: !!catalogId && user?.role === "admin",
    messages: {
      create: "Elemento creado",
      update: "Elemento actualizado",
      delete: "Elemento eliminado",
    },
    filterFn: (i, search) =>
      !search ||
      i.numero.toString().includes(search) ||
      (i.description ?? "").toLowerCase().includes(search.toLowerCase()),
  });

  const modalOpen = crud.showCreate || !!crud.editItem;
  const { isDirty: formIsDirty, resetDirty: resetFormDirty } = useFormDirtyState(initialFormState, form);
  useUnsavedChangesGuard({
    hasUnsavedChanges: formIsDirty && modalOpen,
    message: "Tienes cambios sin guardar en el formulario. ¿Estás seguro de que quieres salir?",
    onLeave: () => { crud.setShowCreate(false); crud.setEditItem(null); resetFormDirty(); },
  });

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await api.uploadFile(file);
      setForm((p) => ({ ...p, image_url: result.url }));
      toastSuccess("Imagen subida");
    } catch (e) {
      toastError("No se pudo subir la imagen", e);
    }
    setUploadingImage(false);
    e.target.value = "";
  }, []);

  const handleSave = useCallback(async () => {
    const data = {
      description: form.description || null,
      image_url: form.image_url || null,
    };
    if (crud.showCreate) {
      await crud.handleCreate(data);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    setForm(initialFormState);
    resetFormDirty();
  }, [crud, form, resetFormDirty, initialFormState]);

  const handleOpenNew = useCallback(() => {
    setForm({ description: "", image_url: "" });
    crud.setShowCreate(true);
  }, [crud]);

  const handleOpenEdit = useCallback((i: CatalogItem) => {
    setForm({
      description: i.description || "",
      image_url: i.image_url || "",
    });
    crud.setEditItem(i);
  }, [crud]);

  const handleCancel = useCallback(() => {
    crud.setShowCreate(false);
    crud.setEditItem(null);
    resetFormDirty();
  }, [crud, resetFormDirty]);

  if (user?.role !== "admin") return null;

  return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <button
          onClick={() => router.push("/admin/catalogs")}
          className="inline-flex items-center gap-1 text-on-surface-variant hover:text-primary text-label-sm font-medium transition-colors"
        >
          <MaterialIcon name="arrow_back" className="text-lg" />
          Volver a catálogos
        </button>

        {catalogLoading || !catalog ? (
          <div className="glass-card rounded-3xl p-6">
            <Skeleton className="h-8 w-1/3 mb-2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <GlassCard className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-headline-lg text-on-surface">
                  {catalog.name}
                </h1>
                <p className="text-on-surface-variant text-body-md mt-1">
                  {catalog.description || "Sin descripción"} · {catalog.item_count} elementos
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="primary" icon="add" onClick={handleOpenNew}>
                  Nuevo Elemento
                </Button>
              </div>
            </div>
          </GlassCard>
        )}

        {crud.loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="product" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {crud.filteredItems.map((i) => (
                <GlassCard
                  key={i.id}
                  className="overflow-hidden flex flex-col h-72"
                  hover
                >
                  <div className="relative flex-1 min-h-48">
                    {i.image_url ? (
                      <Image
                        src={i.image_url}
                        alt={`Elemento #${i.numero}`}
                        fill
                        className="object-cover"
                        unoptimized={i.image_url.startsWith("http://localhost:8000/uploads/")}
                      />
                    ) : (
                      <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                        <MaterialIcon name="image" className="text-5xl text-outline-variant" />
                      </div>
                    )}
                    <span className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-primary font-bold text-label-sm shadow-sm">
                      # {i.numero}
                    </span>
                    <div className="absolute top-3 right-3 flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(i)}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-sm text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <MaterialIcon name="edit" className="text-lg" />
                      </button>
                      <button
                        onClick={() => crud.handleDelete(i.id)}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-white/90 backdrop-blur-md shadow-sm text-on-surface-variant hover:text-error transition-colors"
                      >
                        <MaterialIcon name="delete" className="text-lg" />
                      </button>
                    </div>
                  </div>
                  {i.description && (
                    <div className="p-4">
                      <p className="text-label-sm text-secondary font-bold mb-1">
                        N.º {i.numero}
                      </p>
                      <p className="text-body-md text-on-surface-variant line-clamp-2">
                        {i.description}
                      </p>
                    </div>
                  )}
                </GlassCard>
              ))}
              {crud.filteredItems.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <MaterialIcon name="grid_view" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">Este catálogo aún no tiene elementos</p>
                  <Button variant="secondary" size="sm" icon="add" onClick={handleOpenNew} className="mt-4">
                    Añadir el primero
                  </Button>
                </div>
              )}
            </div>
            <ListFooter
              hasMore={crud.hasMore}
              loading={crud.loadingMore}
              pageSize={12}
              loaded={crud.totalLoaded}
              total={crud.totalCount}
              onLoadMore={crud.loadMore}
            />
          </>
        )}

        {(crud.editItem || crud.showCreate) && (
          <AdminCrudModal
            open
            onClose={handleCancel}
            title={
              crud.showCreate
                ? "Nuevo Elemento"
                : `Editar Elemento #${crud.editItem?.numero}`
            }
            size="md"
            saving={crud.saving || crud.creating}
            saveDisabled={false}
            onSave={handleSave}
          >
            <div className="space-y-4">
              {crud.editItem && (
                <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-4 py-3">
                  <p className="text-label-sm text-on-surface-variant">
                    Número asignado automáticamente:{" "}
                    <span className="font-bold text-primary">#{crud.editItem.numero}</span>
                  </p>
                </div>
              )}
              <FormField label="Descripción">
                <TextareaField
                  value={form.description}
                  onChange={(v: string) => setForm((p) => ({ ...p, description: v }))}
                  placeholder="Descripción del elemento..."
                />
              </FormField>
              <FormField label="Foto">
                <div className="flex items-center gap-3">
                  {form.image_url && (
                    <Image
                      src={form.image_url}
                      alt="Preview"
                      width={80}
                      height={80}
                      className="w-20 h-20 rounded-xl object-cover"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="absolute opacity-0 w-0 h-0 pointer-events-none"
                      onChange={handleImageUpload}
                      disabled={uploadingImage}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="upload"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={uploadingImage}
                    >
                      {uploadingImage ? "Subiendo..." : "Seleccionar archivo"}
                    </Button>
                    {form.image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="delete"
                        onClick={() => setForm((p) => ({ ...p, image_url: "" }))}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </FormField>
            </div>
          </AdminCrudModal>
        )}
      </div>
    </PullToRefresh>
  );
}

"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { api, Catalog, CatalogInput } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import SearchBar from "@/components/ui/SearchBar";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";
import { useUnsavedChangesGuard, useFormDirtyState } from "@/hooks/useUnsavedChangesGuard";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function AdminCatalogsPage() {
  const { user } = useAuthStore();
  const router = useRouter();

  const [form, setForm] = useState<{
    name: string;
    description: string;
    cover_image_url: string;
  }>({ name: "", description: "", cover_image_url: "" });

  const initialFormState = useMemo(
    () => ({ name: "", description: "", cover_image_url: "" }),
    []
  );

  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  const crud = useAdminCrud<Catalog, CatalogInput, CatalogInput>({
    queryKey: ["admin-catalogs"],
    fetcher: (p) => api.getCatalogs(p, debouncedSearch || undefined),
    createFn: (data) => api.createCatalog(data),
    updateFn: (id, data) => api.updateCatalog(id, data),
    deleteFn: (id) => api.deleteCatalog(id),
    getDisplayName: (c) => c.name,
    getId: (c) => c.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: debouncedSearch,
    messages: {
      create: "Catálogo creado",
      update: "Catálogo actualizado",
      delete: "Catálogo eliminado",
    },
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
      setForm((p) => ({ ...p, cover_image_url: result.url }));
      toastSuccess("Imagen subida");
    } catch (e) {
      toastError("No se pudo subir la imagen", e);
    }
    setUploadingImage(false);
    e.target.value = "";
  }, []);

  const handleSave = useCallback(async () => {
    const data = {
      name: form.name,
      description: form.description || null,
      cover_image_url: form.cover_image_url || null,
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
    setForm({ name: "", description: "", cover_image_url: "" });
    crud.setShowCreate(true);
  }, [crud]);

  const handleOpenEdit = useCallback((c: Catalog) => {
    setForm({
      name: c.name,
      description: c.description || "",
      cover_image_url: c.cover_image_url || "",
    });
    crud.setEditItem(c);
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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Gestionar Catálogos
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {crud.totalCount} catálogos publicados
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              placeholder="Buscar catálogos..."
              value={search}
              onChange={setSearch}
              size="sm"
            />
            <Button variant="primary" icon="add" onClick={handleOpenNew}>
              Nuevo Catálogo
            </Button>
          </div>
        </div>

        {crud.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="product" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {crud.filteredItems.map((c) => (
                <GlassCard key={c.id} className="overflow-hidden cursor-pointer group" hover>
                  <div className="p-6" onClick={() => router.push(`/admin/catalogs/${c.id}`)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden">
                        {c.cover_image_url ? (
                          <Image
                            src={c.cover_image_url}
                            alt={c.name}
                            fill
                            className="object-cover group-hover:scale-105 transition-transform duration-300"
                            unoptimized={c.cover_image_url.startsWith("http://localhost:8000/uploads/")}
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-container-high flex items-center justify-center">
                            <MaterialIcon name="collections_bookmark" className="text-2xl text-outline-variant" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEdit(c); }}
                          className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <MaterialIcon name="edit" className="text-lg" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); crud.handleDelete(c.id); }}
                          className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                        >
                          <MaterialIcon name="delete" className="text-lg" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-display text-title-md text-on-surface mb-1">
                      {c.name}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
                      {c.description}
                    </p>
                    <div className="flex items-center gap-2 text-label-sm text-on-surface-variant">
                      <MaterialIcon name="grid_view" className="text-base" />
                      {c.item_count} elementos
                      <span className="text-secondary font-bold ml-auto inline-flex items-center gap-1">
                        Gestionar
                        <MaterialIcon name="chevron_right" className="text-base" />
                      </span>
                    </div>
                  </div>
                </GlassCard>
              ))}
              {crud.filteredItems.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <MaterialIcon name="collections_bookmark" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">No se encontraron catálogos</p>
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
            title={crud.showCreate ? "Nuevo Catálogo" : "Editar Catálogo"}
            size="md"
            saving={crud.saving || crud.creating}
            saveDisabled={!form.name.trim()}
            onSave={handleSave}
          >
            <div className="space-y-4">
              <FormField label="Nombre" required>
                <InputField
                  value={form.name}
                  onChange={(v: string) => setForm((p) => ({ ...p, name: v }))}
                  placeholder="Ej: Tarjetas coleccionables"
                  autoFocus
                  firstInput
                />
              </FormField>
              <FormField label="Descripción">
                <TextareaField
                  value={form.description}
                  onChange={(v: string) => setForm((p) => ({ ...p, description: v }))}
                  placeholder="Descripción del catálogo..."
                />
              </FormField>
              <FormField label="Imagen de portada (opcional)">
                <div className="flex items-center gap-3">
                  {form.cover_image_url && (
                    <Image
                      src={form.cover_image_url}
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
                    {form.cover_image_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="delete"
                        onClick={() => setForm((p) => ({ ...p, cover_image_url: "" }))}
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

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Image from "next/image";
import { api, Product, EnumValue, ProductInput } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminCrudModal, FormField, InputField, TextareaField, SelectField, ToggleButtonGroup } from "@/components/ui/AdminCrudModal";
import { EnumMissingNotice } from "@/components/ui/EnumMissingNotice";
import { useUnsavedChangesGuard, useFormDirtyState } from "@/hooks/useUnsavedChangesGuard";
import PullToRefresh from "@/components/ui/PullToRefresh";

export default function AdminProductsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "borgin" | "flourish">("all");
  const [form, setForm] = useState<{
    name: string;
    description: string;
    price: string;
    category: string;
    shop: "borgin" | "flourish";
    image_url: string;
    stock: string;
    specification_placeholder: string;
  }>({
    name: "",
    description: "",
    price: "",
    category: "",
    shop: "borgin",
    image_url: "",
    stock: "",
    specification_placeholder: "",
  });

  const initialFormState = useMemo(() => ({
    name: "",
    description: "",
    price: "",
    category: "",
    shop: "borgin" as "borgin" | "flourish",
    image_url: "",
    stock: "",
    specification_placeholder: "",
  }), []);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [borginCategories, setBorginCategories] = useState<EnumValue[]>([]);
  const [flourishCategories, setFlourishCategories] = useState<EnumValue[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Server-side filter reset key
  const resetKey = [filter, debouncedSearch];

  const crud = useAdminCrud<Product, ProductInput, ProductInput>({
    queryKey: ["admin-products"],
    fetcher: (p) =>
      api.getProducts(
        filter === "all" ? undefined : filter,
        p,
        undefined,
        debouncedSearch || undefined
      ),
    createFn: (data) => api.createProduct(data),
    updateFn: (id, data) => api.updateProduct(id, data),
    deleteFn: (id) => api.deleteProduct(id),
    getDisplayName: (p) => p.name,
    getId: (p) => p.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey,
    messages: {
      create: "Producto creado",
      update: "Producto actualizado",
      delete: "Producto eliminado",
    },
  });

  const modalOpen = crud.showCreate || !!crud.editItem;
  const { isDirty: formIsDirty, resetDirty: resetFormDirty } = useFormDirtyState(initialFormState, form);
  useUnsavedChangesGuard({
    hasUnsavedChanges: formIsDirty && modalOpen,
    message: "Tienes cambios sin guardar en el formulario. ¿Estás seguro de que quieres salir?",
    onLeave: () => { crud.setShowCreate(false); crud.setEditItem(null); resetFormDirty(); },
  });

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    api.getEnumCategoryByCode("borgin_category").then((c) => {
      if (c) setBorginCategories(c.values);
    }).catch((e) => toastError("No se pudieron cargar las categorías de Borgin & Burkes", e));
    api.getEnumCategoryByCode("book_category").then((c) => {
      if (c) setFlourishCategories(c.values);
    }).catch((e) => toastError("No se pudieron cargar las categorías de libros", e));
  }, [user, router]);

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
      name: form.name,
      description: form.description || null,
      price: parseInt(form.price) || 0,
      category: form.category,
      shop: form.shop,
      image_url: form.image_url || null,
      stock: parseInt(form.stock) || 0,
      specification_placeholder:
        form.shop === "flourish" ? form.specification_placeholder.trim() || null : undefined,
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
    setForm({
      name: "",
      description: "",
      price: "",
      category: "",
      shop: "borgin",
      image_url: "",
      stock: "",
      specification_placeholder: "",
    });
    crud.setShowCreate(true);
  }, [crud]);

  const handleOpenEdit = useCallback((p: Product) => {
    setForm({
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      category: p.category,
      shop: p.shop,
      image_url: p.image_url || "",
      stock: p.stock.toString(),
      specification_placeholder: p.specification_placeholder || "",
    });
    crud.setEditItem(p);
  }, [crud]);

  const handleCancel = useCallback(() => {
    crud.setShowCreate(false);
    crud.setEditItem(null);
    resetFormDirty();
  }, [crud, resetFormDirty]);

  if (user?.role !== "admin") return null;

  const getDisplayCount = () => crud.totalCount;
  const getDisplayLabel = () => {
    if (filter === "all") return "productos en catálogo";
    return `${filter === "borgin" ? "Borgin & Burkes" : "Flourish & Blotts"} en catálogo`;
  };

  return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Gestionar Productos
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {getDisplayCount()} {getDisplayLabel()}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <SearchBar
              placeholder="Buscar productos..."
              value={search}
              onChange={setSearch}
              size="sm"
            />
            <Button variant="primary" icon="add" onClick={handleOpenNew}>
              Nuevo Producto
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "borgin", "flourish"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {f === "all" ? "Todos" : f === "borgin" ? "Borgin & Burkes" : "Flourish & Blotts"}
            </button>
          ))}
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
            {crud.filteredItems.map((p) => (
              <GlassCard key={p.id} className="overflow-hidden" hover>
                <div className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge variant="tag" color={p.shop === "borgin" ? "default" : "primary"}>
                        {p.shop === "borgin" ? "Borgin" : "Flourish"}
                      </Badge>
                      <Badge variant="tag">{p.category}</Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(p)}
                        className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                      >
                        <MaterialIcon name="edit" className="text-lg" />
                      </button>
                      <button
                        onClick={() => crud.handleDelete(p.id)}
                        className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                      >
                        <MaterialIcon name="delete" className="text-lg" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-display text-title-md text-on-surface mb-1">
                    {p.name}
                  </h3>
                  <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
                    {p.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <p className="font-display text-title-md text-secondary">
                      <MaterialIcon name="diamond" className="text-[1em] text-secondary" filled inline /> {p.price.toLocaleString()}
                    </p>
                    <p className="text-label-sm text-on-surface-variant">
                      Stock: {p.stock}
                    </p>
                  </div>
                </div>
              </GlassCard>
            ))}
            {crud.filteredItems.length === 0 && (
              <div className="col-span-full text-center py-16">
                <MaterialIcon name="inventory_2" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                <p className="text-on-surface-variant text-body-md">No se encontraron productos</p>
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

        {/* Create/Edit Modal */}
        {(crud.editItem || crud.showCreate) && (
          <AdminCrudModal
            open
            onClose={handleCancel}
            title={crud.showCreate ? "Nuevo Producto" : "Editar Producto"}
            size="md"
            saving={crud.saving || crud.creating}
            saveDisabled={
              (form.shop === "borgin" && borginCategories.length === 0) ||
              (form.shop === "flourish" && flourishCategories.length === 0) ||
              (form.shop === "flourish" &&
                !form.specification_placeholder.trim())
            }
            onSave={handleSave}
          >
            {form.shop === "borgin" && borginCategories.length === 0 && (
              <EnumMissingNotice
                enumCode="borgin_category"
                displayName="Borgin & Burkes"
                itemName="un producto de Borgin & Burkes"
              />
            )}
            {form.shop === "flourish" && flourishCategories.length === 0 && (
              <EnumMissingNotice
                enumCode="book_category"
                displayName="Flourish & Blotts"
                itemName="un producto de Flourish & Blotts"
              />
            )}
            {!(
              (form.shop === "borgin" && borginCategories.length === 0) ||
              (form.shop === "flourish" && flourishCategories.length === 0)
            ) && (
            <div className="space-y-4">
              <FormField label="Nombre" required>
                <InputField
                  value={form.name}
                  onChange={(v: string) => setForm((p) => ({ ...p, name: v }))}
                  placeholder="Ej: Varita de Saúco"
                  autoFocus
                  firstInput
                />
              </FormField>
              <FormField label="Descripción" required>
                <TextareaField
                  value={form.description}
                  onChange={(v: string) => setForm((p) => ({ ...p, description: v }))}
                  placeholder="Descripción del producto..."
                />
              </FormField>
              <div className="grid grid-cols-2 gap-4">
                <FormField label="Precio" required>
                  <InputField
                    type="number"
                    value={form.price}
                    onChange={(v: string) => setForm((p) => ({ ...p, price: v }))}
                    placeholder="0"
                  />
                </FormField>
                <FormField label="Stock" required>
                  <InputField
                    type="number"
                    value={form.stock}
                    onChange={(v: string) => setForm((p) => ({ ...p, stock: v }))}
                    placeholder="0"
                  />
                </FormField>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Tienda" required className="sm:col-span-2">
                  <ToggleButtonGroup
                    value={form.shop}
                    onChange={(v: string) => setForm((p) => ({ ...p, shop: v as "borgin" | "flourish", category: "" }))}
                    options={[
                      { value: "borgin", label: "Borgin" },
                      { value: "flourish", label: "Flourish" },
                    ]}
                  />
                </FormField>
                <FormField label="Categoria" required className="sm:col-span-2">
                  <SelectField
                    value={form.category}
                    onChange={(v: string) => setForm((p) => ({ ...p, category: v }))}
                    options={form.shop === "borgin" 
                      ? borginCategories.map(c => ({ value: c.label, label: c.label }))
                      : flourishCategories.map(c => ({ value: c.label, label: c.label }))}
                    placeholder="Seleccionar..."
                  />
                </FormField>
              </div>
              {form.shop === "flourish" && (
                <>
                  <FormField
                    label="Texto guia para el comprador"
                    required
                    helpText={
                      form.specification_placeholder.trim()
                        ? `Se mostrará al comprador: "${form.specification_placeholder.trim()}"`
                        : "Ej: 'Especifica el nombre de la canción', 'Indica el número de foto del catálogo', 'Escribe el nombre del alumno'"
                    }
                  >
                    <InputField
                      value={form.specification_placeholder}
                      onChange={(v: string) =>
                        setForm((p) => ({ ...p, specification_placeholder: v }))
                      }
                      placeholder="Especifica el nombre de la canción"
                    />
                  </FormField>
                  <p className="text-label-sm text-on-surface-variant">
                    Todos los productos de Flourish & Blotts requieren especificación del comprador.
                    La especificación se pide al agregar al carrito y el administrador la ve en Consumición.
                  </p>
                </>
              )}
              <FormField label="Imagen (opcional)">
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
            )}
          </AdminCrudModal>
        )}
      </div>
    </PullToRefresh>
  );
}
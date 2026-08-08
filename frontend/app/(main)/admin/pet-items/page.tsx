"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { api, PetItem, PetType, PetItemKind, EnumValue } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminCrudModal, FormField, InputField, TextareaField, SelectField, ToggleButtonGroup } from "@/components/ui/AdminCrudModal";
import { EnumMissingNotice } from "@/components/ui/EnumMissingNotice";
import ListFooter from "@/components/ui/ListFooter";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

const KIND_LABELS: Record<PetItemKind, string> = {
  food: "Comida",
  toy: "Juguete",
};

type Filter = "all" | PetItemKind;

const defaultCreateForm: Partial<PetItem> = {
  name: "",
  description: "",
  kind: "food",
  pet_type: "Criaturas pequeñas",
  price: 0,
  restore_amount: 10,
  pack_size: 1,
  image_url: "",
};

export default function AdminPetItemsPage() {
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    kind: "food" as PetItemKind,
    pet_type: "Criaturas pequeñas" as PetType,
    price: "",
    restore_amount: "",
    pack_size: "",
    image_url: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [petTypes, setPetTypes] = useState<EnumValue[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    api.getEnumCategoryByCode("pet_type").then((cat) => {
      if (cat) setPetTypes(cat.values);
    }).catch((e) => toastError("No se pudieron cargar los tipos de mascota", e));
  }, []);

  const crud = useAdminCrud<PetItem, Partial<PetItem>, Partial<PetItem>>({
    queryKey: ["admin-pet-items"],
    fetcher: (p) =>
      api.getPetItems(
        {
          kind: filter === "all" ? undefined : filter,
          search: debouncedSearch || undefined,
        },
        p
      ),
    createFn: (data) => api.createPetItem(data),
    updateFn: (id, data) => api.updatePetItem(id, data),
    deleteFn: (id) => api.deletePetItem(id),
    getDisplayName: (it) => it.name,
    getId: (it) => it.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: [filter, debouncedSearch],
    defaultCreateForm,
    messages: {
      create: "Objeto creado",
      update: "Objeto actualizado",
      delete: "Objeto eliminado",
    },
  });

  const openNew = () => {
    setForm({
      name: "",
      description: "",
      kind: "food",
      pet_type: "Criaturas pequeñas",
      price: "",
      restore_amount: "",
      pack_size: "",
      image_url: "",
    });
    setShowCreate(true);
  };

  const openEdit = (it: PetItem) => {
    setForm({
      name: it.name,
      description: it.description ?? "",
      kind: it.kind,
      pet_type: it.pet_type,
      price: it.price.toString(),
      restore_amount: it.restore_amount.toString(),
      pack_size: it.pack_size.toString(),
      image_url: it.image_url ?? "",
    });
    crud.setEditItem(it);
  };

  const handleSave = async () => {
    const data: Partial<PetItem> = {
      name: form.name,
      description: form.description,
      kind: form.kind,
      pet_type: form.pet_type,
      price: parseInt(form.price) || 0,
      restore_amount: Math.max(1, parseInt(form.restore_amount) || 10),
      pack_size: Math.max(1, parseInt(form.pack_size) || 1),
      image_url: form.image_url || undefined,
    };
    if (showCreate) {
      await crud.handleCreate(data);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    setForm({
      name: "",
      description: "",
      kind: "food",
      pet_type: "Criaturas pequeñas",
      price: "",
      restore_amount: "",
      pack_size: "",
      image_url: "",
    });
    setShowCreate(false);
    crud.setEditItem(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
  };

  if (user?.role !== "admin") return null;

  const getDisplayCount = () => crud.totalCount;

  const getDisplayLabel = () => {
    if (getDisplayCount() === 1) {
      if (filter === "all") return "objeto de mascota en catálogo";
      return `${KIND_LABELS[filter]} en catálogo`;
    }
    if (filter === "all") return "objetos de mascota en catálogo";
    return `${KIND_LABELS[filter]}s en catálogo`;
  };

  return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Comida y Juguetes
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {getDisplayCount()} {getDisplayLabel()}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Buscar objetos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            <Button variant="primary" icon="add" onClick={openNew}>
              Nuevo Objeto
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["all", "food", "toy"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-label-sm font-medium transition-all ${
                filter === f
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {f === "all" ? "Todos" : KIND_LABELS[f]}
            </button>
          ))}
        </div>

        {crud.loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="card" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {crud.filteredItems.map((it) => (
                <div key={it.id} className="glass-card rounded-xl overflow-hidden hover:bg-surface-container-high transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="tag" color={it.kind === "food" ? "success" : "primary"}>
                          {KIND_LABELS[it.kind]}
                        </Badge>
                        <Badge variant="tag">{it.pet_type}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(it)}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <MaterialIcon name="edit" className="text-lg" />
                        </button>
                        <button
                          onClick={() => crud.handleDelete(it.id)}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                        >
                          <MaterialIcon name="delete" className="text-lg" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-display text-title-md text-on-surface mb-1">
                      {it.name}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
                      {it.description}
                    </p>
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-display text-title-md text-secondary">
                        <MaterialIcon name="diamond" className="text-[1em] text-secondary" filled inline /> {it.price.toLocaleString()}
                      </p>
                      <p className="text-label-sm text-success font-medium">
                        +{it.restore_amount} {it.kind === "food" ? "hambre" : "felicidad"}
                      </p>
                    </div>
                    <p className="text-label-sm text-on-surface-variant">
                      Lote: {it.pack_size} {it.pack_size === 1 ? "unidad" : "unidades"} por compra
                    </p>
                  </div>
                </div>
              ))}
              {crud.filteredItems.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <MaterialIcon
                    name="pet_supplies"
                    className="text-5xl text-outline-variant mb-3 block mx-auto"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    No se encontraron objetos
                  </p>
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

        {(showCreate || crud.editItem) && (
          <AdminCrudModal
            open
            onClose={() => { setShowCreate(false); crud.setEditItem(null); }}
            title={showCreate ? "Nuevo Objeto" : "Editar Objeto"}
            size="md"
            saving={crud.saving || crud.creating}
            saveDisabled={petTypes.length === 0}
            onSave={handleSave}
          >
            {petTypes.length === 0 && (
              <EnumMissingNotice
                enumCode="pet_type"
                displayName="Tipos de Mascota"
                itemName="comida o juguetes de mascota"
              />
            )}
            {petTypes.length > 0 && (
            <div className="space-y-4">
                <FormField label="Nombre" required>
                  <InputField
                    value={form.name}
                    onChange={(v: string) => setForm((p) => ({ ...p, name: v }))}
                    autoFocus
                    firstInput
                  />
                </FormField>
                <FormField label="Descripcion">
                  <TextareaField
                    value={form.description}
                    onChange={(v: string) => setForm((p) => ({ ...p, description: v }))}
                  />
                </FormField>
                <div className="flex flex-col gap-4 sm:grid sm:grid-cols-6">
                  <div className="flex gap-4 sm:contents">
                    <FormField label="Tipo de objeto" required className="flex-1 sm:order-1 sm:col-span-3">
                      <ToggleButtonGroup
                        value={form.kind}
                        onChange={(v) => setForm((p) => ({ ...p, kind: v }))}
                        options={[
                          { value: "food", label: "Comida" },
                          { value: "toy", label: "Juguete" },
                        ]}
                      />
                    </FormField>
                    <FormField label="Lote (uds.)" required className="w-20 shrink-0 sm:order-5 sm:col-span-2 sm:w-auto sm:max-w-none">
                      <InputField
                        type="number"
                        value={form.pack_size}
                        onChange={(v: string) => setForm((p) => ({ ...p, pack_size: v }))}
                        placeholder="1"
                      />
                    </FormField>
                  </div>
                  <FormField label="Tipo de mascota" required className="sm:order-2 sm:col-span-3">
                    <SelectField
                      value={form.pet_type}
                      onChange={(v: string) => setForm((p) => ({ ...p, pet_type: v as PetType }))}
                      options={petTypes.map((pt) => ({ value: pt.label, label: pt.label }))}
                      placeholder="Seleccionar..."
                    />
                  </FormField>
                  <div className="flex gap-4 sm:contents">
                    <FormField label="Precio" required className="flex-1 sm:order-3 sm:col-span-2">
                      <InputField
                        type="number"
                        value={form.price}
                        onChange={(v: string) => setForm((p) => ({ ...p, price: v }))}
                        placeholder="0"
                      />
                    </FormField>
                    <FormField label="Restaura" required className="flex-1 sm:order-4 sm:col-span-2">
                      <InputField
                        type="number"
                        value={form.restore_amount}
                        onChange={(v: string) => setForm((p) => ({ ...p, restore_amount: v }))}
                        placeholder="1-100"
                      />
                    </FormField>
                  </div>
                </div>
                <p className="text-label-sm text-on-surface-variant -mt-2">
                  &ldquo;Restaura&rdquo; es cuanto sube la estadistica por uso. &ldquo;Lote&rdquo; es cuantas unidades recibe el comprador por compra.
                </p>
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
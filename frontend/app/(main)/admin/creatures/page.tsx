"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, Creature, EnumValue } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField, InputField, TextareaField, SelectField } from "@/components/ui/AdminCrudModal";
import ListFooter from "@/components/ui/ListFooter";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { MaterialIcon, Skeleton } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import PullToRefresh from "@/components/ui/PullToRefresh";

const RARITY_LABELS: Record<string, string> = {
  common: "Comun",
  uncommon: "Poco Comun",
  rare: "Raro",
  legendary: "Legendario",
  ethereal: "Etereo",
};

const RARITY_COLORS: Record<string, string> = {
  common: "default",
  uncommon: "secondary",
  rare: "primary",
  legendary: "secondary",
  ethereal: "primary",
};

const defaultCreateForm: Partial<Creature> = {
  name: "",
  description: "",
  rarity: "common",
  pet_type: "Criaturas pequeñas",
  price: 0,
  image_url: "",
  required_user_level: 1,
  required_sanctuary_level: 0,
  ability: "",
};

export default function AdminCreaturesPage() {
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    rarity: "common" as Creature["rarity"],
    pet_type: "Criaturas pequeñas" as Creature["pet_type"],
    price: "",
    image_url: "",
    required_user_level: "",
    required_sanctuary_level: "",
    ability: "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [petTypes, setPetTypes] = useState<EnumValue[]>([]);

  useEffect(() => {
    api.getEnumCategoryByCode("pet_type").then((cat) => {
      if (cat) setPetTypes(cat.values);
    }).catch((e) => toastError("No se pudo cargar los tipos de mascota", e));
  }, []);

  const crud = useAdminCrud<Creature, Partial<Creature>, Partial<Creature>>({
    queryKey: ["admin-creatures"],
    fetcher: (p) => api.getCreatures(p),
    createFn: (data) => api.createCreature(data),
    updateFn: (id, data) => api.updateCreature(id, data),
    deleteFn: (id) => api.deleteCreature(id),
    getDisplayName: (c) => c.name,
    getId: (c) => c.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    defaultCreateForm,
    messages: {
      create: "Criatura creada",
      update: "Criatura actualizada",
      delete: "Criatura eliminada",
    },
    filterFn: (c, search) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.rarity.toLowerCase().includes(search.toLowerCase()),
  });

  const openNew = () => {
    setForm({
      name: "",
      description: "",
      rarity: "common",
      pet_type: "Criaturas pequeñas",
      price: "",
      image_url: "",
      required_user_level: "",
      required_sanctuary_level: "",
      ability: "",
    });
    setShowCreate(true);
  };

  const openEdit = (c: Creature) => {
    setForm({
      name: c.name,
      description: c.description,
      rarity: c.rarity,
      pet_type: c.pet_type,
      price: c.price.toString(),
      image_url: c.image_url || "",
      required_user_level: (c.required_user_level ?? 1).toString(),
      required_sanctuary_level: (c.required_sanctuary_level ?? 0).toString(),
      ability: c.ability || "",
    });
    crud.setEditItem(c);
  };

  const handleSave = async () => {
    const data: Partial<Creature> = {
      name: form.name,
      description: form.description,
      rarity: form.rarity,
      pet_type: form.pet_type,
      price: parseInt(form.price) || 0,
      image_url: form.image_url || undefined,
      required_user_level: Math.max(1, parseInt(form.required_user_level) || 1),
      required_sanctuary_level: Math.max(0, parseInt(form.required_sanctuary_level) || 0),
      ability: form.ability.trim() || undefined,
    };
    if (showCreate) {
      await crud.handleCreate(data);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    setForm({
      name: "",
      description: "",
      rarity: "common",
      pet_type: "Criaturas pequeñas",
      price: "",
      image_url: "",
      required_user_level: "",
      required_sanctuary_level: "",
      ability: "",
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

return (
    <PullToRefresh onRefresh={crud.refresh}>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-headline-lg text-on-surface">
              Gestionar Criaturas
            </h1>
            <p className="text-on-surface-variant text-body-md mt-1">
              {crud.totalCount} criaturas en el Santuario
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Buscar criaturas..."
              value={crud.search}
              onChange={(e) => crud.setSearch(e.target.value)}
              className="w-full sm:w-64 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            <Button variant="primary" icon="add" onClick={openNew}>
              Nueva Criatura
            </Button>
          </div>
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
              {crud.filteredItems.map((c) => (
                <div key={c.id} className="glass-card rounded-xl overflow-hidden hover:bg-surface-container-high transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant="rarity" color={RARITY_COLORS[c.rarity] as "default" | "secondary" | "primary" | "error" | "success"}>
                        {RARITY_LABELS[c.rarity] || c.rarity}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                        >
                          <MaterialIcon name="edit" className="text-lg" />
                        </button>
                      </div>
                    </div>
                    <h3 className="font-display text-title-md text-on-surface mb-1">
                      {c.name}
                    </h3>
                    <p className="text-label-sm text-on-surface-variant line-clamp-2 mb-3">
                      {c.description}
                    </p>
                    {c.ability && (
                      <div className="flex items-start gap-1.5 mb-3 bg-secondary/5 border border-secondary/10 rounded-lg px-2.5 py-1.5">
                        <MaterialIcon name="auto_awesome" className="text-secondary text-[1em] mt-0.5" filled />
                        <p className="text-label-sm text-on-surface-variant leading-snug">{c.ability}</p>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <p className="font-display text-title-md text-secondary">
                        <MaterialIcon name="diamond" className="text-[1em] text-secondary" filled inline /> {c.price.toLocaleString()}
                      </p>
                      <p className="text-label-sm text-on-surface-variant capitalize">
                        {RARITY_LABELS[c.rarity] || c.rarity}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {crud.filteredItems.length === 0 && (
                <div className="col-span-full text-center py-16">
                  <MaterialIcon
                    name="pets"
                    className="text-5xl text-outline-variant mb-3 block mx-auto"
                  />
                  <p className="text-on-surface-variant text-body-md">
                    No se encontraron criaturas
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
            title={showCreate ? "Nueva Criatura" : "Editar Criatura"}
            size="md"
            saving={crud.saving || crud.creating}
            onSave={handleSave}
          >
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Precio" required>
                    <InputField
                      type="number"
                      value={form.price}
                      onChange={(v: string) => setForm((p) => ({ ...p, price: v }))}
                      placeholder="0"
                    />
                  </FormField>
                  <FormField label="Rareza" required>
                    <SelectField
                      value={form.rarity}
                      onChange={(v: string) => setForm((p) => ({ ...p, rarity: v as Creature["rarity"] }))}
                      options={[
                        { value: "common", label: "Comun" },
                        { value: "uncommon", label: "Poco Comun" },
                        { value: "rare", label: "Raro" },
                        { value: "legendary", label: "Legendario" },
                        { value: "ethereal", label: "Etereo" },
                      ]}
                      placeholder="Seleccionar..."
                    />
                  </FormField>
                </div>
                <FormField label="Tipo de mascota" required>
                  <SelectField
                    value={form.pet_type}
                    onChange={(v: string) => setForm((p) => ({ ...p, pet_type: v as Creature["pet_type"] }))}
                    options={petTypes.map((pt) => ({ value: pt.label, label: pt.label }))}
                    placeholder="Seleccionar..."
                  />
                </FormField>
                <p className="text-label-sm text-on-surface-variant mt-1">Determina que comida y juguetes acepta.</p>
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Nivel mágico req.">
                    <InputField
                      type="number"
                      min={1}
                      value={form.required_user_level}
                      onChange={(v: string) => setForm((p) => ({ ...p, required_user_level: v }))}
                      placeholder="1 = sin requisito"
                    />
                  </FormField>
                  <FormField label="Nivel santuario req.">
                    <InputField
                      type="number"
                      min={0}
                      value={form.required_sanctuary_level}
                      onChange={(v: string) => setForm((p) => ({ ...p, required_sanctuary_level: v }))}
                      placeholder="0 = sin requisito"
                    />
                  </FormField>
                </div>
                <FormField label="Habilidad especial">
                  <InputField
                    value={form.ability}
                    onChange={(v: string) => setForm((p) => ({ ...p, ability: v }))}
                    placeholder="Ej: Doble de Zerines al cuidar"
                  />
                </FormField>
                <p className="text-label-sm text-on-surface-variant mt-1">Beneficio que comparten todas las mascotas de esta especie.</p>
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
          </AdminCrudModal>
        )}
      </div>
    </PullToRefresh>
  );
}
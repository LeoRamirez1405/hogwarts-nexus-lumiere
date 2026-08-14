"use client";

import { useState } from "react";
import { api, PackType, PackTypeInput } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminCrudModal,
  FormField,
  InputField,
  TextareaField,
} from "@/components/ui/AdminCrudModal";
import { AdminCrudTable, type ColumnDef } from "@/components/ui/AdminCrudTable";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ZerineDisplay from "@/components/ui/ZerineDisplay";

const RARITIES = ["common", "rare", "ultra_rare", "special", "legendary"] as const;
const RARITY_LABEL: Record<string, string> = {
  common: "Común",
  rare: "Rara",
  ultra_rare: "Ultra Rara",
  special: "Especial",
  legendary: "Legendaria",
};

interface FormState {
  name: string;
  description: string;
  price_zerines: string;
  num_cards: string;
  weights: Record<string, string>;
  enabled: boolean;
}

const defaultForm = (): FormState => ({
  name: "",
  description: "",
  price_zerines: "50",
  num_cards: "5",
  weights: { common: "55", rare: "25", ultra_rare: "12", special: "6", legendary: "2" },
  enabled: true,
});

export default function AdminPacksPage() {
  const { user } = useAuthStore();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [form, setForm] = useState<FormState>(defaultForm());
  const [showCreate, setShowCreate] = useState(false);

  const crud = useAdminCrud<PackType, PackTypeInput, PackTypeInput>({
    queryKey: ["admin-packs"],
    fetcher: (p) => api.listPackTypes(p.skip, p.limit),
    createFn: (data) => api.createPackType(data),
    updateFn: (id, data) => api.updatePackType(id, data),
    deleteFn: (id) => api.deletePackType(id),
    getDisplayName: (p) => p.name,
    getId: (p) => p.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: debouncedSearch,
    filterFn: (pack, q) => pack.name.toLowerCase().includes(q.toLowerCase()),
    defaultCreateForm: {} as PackTypeInput,
    messages: {
      create: "Tipo de sobre creado",
      update: "Tipo de sobre actualizado",
      delete: "Tipo de sobre eliminado",
    },
  });

  if (user?.role !== "admin") return null;

  const weightSum = RARITIES.reduce((acc, r) => acc + (parseInt(form.weights[r]) || 0), 0);
  const weightsValid = weightSum === 100;
  const formValid = !!form.name.trim() && parseInt(form.price_zerines) > 0 && parseInt(form.num_cards) > 0 && weightsValid;

  const openNew = () => {
    setForm(defaultForm());
    setShowCreate(true);
  };

  const openEdit = (pack: PackType) => {
    setForm({
      name: pack.name,
      description: pack.description ?? "",
      price_zerines: String(pack.price_zerines),
      num_cards: String(pack.num_cards),
      weights: Object.fromEntries(
        RARITIES.map((r) => [r, String(pack.rarity_weights?.[r] ?? 0)])
      ),
      enabled: pack.enabled,
    });
    crud.setEditItem(pack);
  };

  const buildPayload = (): PackTypeInput => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price_zerines: parseInt(form.price_zerines) || 0,
    num_cards: parseInt(form.num_cards) || 1,
    rarity_weights: Object.fromEntries(
      RARITIES.map((r) => [r, parseInt(form.weights[r]) || 0])
    ),
    enabled: form.enabled,
  });

  const handleSave = async () => {
    const data = buildPayload();
    if (showCreate) {
      await crud.handleCreate(data);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    crud.refresh();
  };

  const columns: ColumnDef<PackType>[] = [
    {
      key: "name",
      header: "Sobre",
      render: (p) => <span className="font-medium text-primary">{p.name}</span>,
    },
    {
      key: "price",
      header: "Precio",
      render: (p) => <ZerineDisplay amount={p.price_zerines} variant="price" />,
    },
    {
      key: "num_cards",
      header: "Cartas",
      render: (p) => <span className="font-mono text-sm">{p.num_cards}</span>,
      hideOnMobile: true,
    },
    {
      key: "enabled",
      header: "Estado",
      render: (p) => (
        <Badge color={p.enabled ? "secondary" : "default"}>{p.enabled ? "Activo" : "Desactivado"}</Badge>
      ),
    },
    {
      key: "weights",
      header: "Probabilidades",
      render: (p) => (
        <span className="text-[11px] text-outline">
          {RARITIES.filter((r) => (p.rarity_weights?.[r] ?? 0) > 0)
            .map((r) => `${RARITY_LABEL[r]}: ${p.rarity_weights[r]}%`)
            .join(" · ")}
        </span>
      ),
      hideOnMobile: true,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">Tipos de Sobre</h1>
          <p className="text-xs text-outline">
            Define precios, número de cartas y probabilidades de rareza (deben sumar 100%).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sobre…"
            className="w-44 rounded-full border border-outline/20 bg-surface-container-low px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <Button onClick={openNew} icon="add">
            Nuevo sobre
          </Button>
        </div>
      </div>

      <AdminCrudTable
        items={crud.filteredItems}
        columns={columns}
        onEdit={openEdit}
        onDelete={(id) => crud.handleDelete(id)}
        getId={(p) => p.id}
        loading={crud.loading}
        emptyMessage="No hay tipos de sobre"
        emptyIcon="markunread_mailbox"
        hasMore={crud.hasMore}
        loadingMore={crud.loadingMore}
        totalLoaded={crud.totalLoaded}
        totalCount={crud.totalCount}
        onLoadMore={crud.loadMore}
        deleteConfirmTitle="Eliminar tipo de sobre"
        deleteConfirmMessage="Los sobres ya entregados con este tipo no se verán afectados."
      />

      <AdminCrudModal
        open={showCreate || !!crud.editItem}
        onClose={() => {
          setShowCreate(false);
          crud.setEditItem(null);
        }}
        title={showCreate ? "Nuevo tipo de sobre" : "Editar tipo de sobre"}
        saving={crud.saving}
        saveDisabled={!formValid}
        onSave={handleSave}
      >
        <FormField label="Nombre" required>
          <InputField
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Ej: Sobre de Lechuza"
            firstInput
          />
        </FormField>
        <FormField label="Descripción">
          <TextareaField
            value={form.description}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Ej: 5 cartas de rareza estándar"
          />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Precio (Zerines)" required>
            <InputField
              type="number"
              value={form.price_zerines}
              onChange={(v) => setForm({ ...form, price_zerines: v })}
            />
          </FormField>
          <FormField label="Cartas por sobre" required>
            <InputField
              type="number"
              value={form.num_cards}
              onChange={(v) => setForm({ ...form, num_cards: v })}
            />
          </FormField>
        </div>

        <FormField
          label="Probabilidades de rareza (%)"
          required
          helpText={
            weightSum === 100
              ? "Probabilidades correctas"
              : `La suma es ${weightSum}% — debe ser exactamente 100%`
          }
          error={weightsValid ? undefined : "La suma debe ser 100%"}
        >
          <div className="space-y-2">
            {RARITIES.map((rarity) => (
              <div key={rarity} className="flex items-center gap-3">
                <span className="w-24 text-xs text-outline">{RARITY_LABEL[rarity]}</span>
                <InputField
                  type="number"
                  value={form.weights[rarity] ?? "0"}
                  onChange={(v) =>
                    setForm({ ...form, weights: { ...form.weights, [rarity]: v } })
                  }
                  className="!px-3 !py-1.5 !text-sm"
                />
                <span className="text-xs text-outline">%</span>
              </div>
            ))}
          </div>
        </FormField>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
            className="h-4 w-4 accent-[#0e3b60]"
          />
          Sobre disponible en la tienda
        </label>
        {!formValid && weightSum !== 100 && (
          <p className="text-xs text-red-600">Revisa las probabilidades: deben sumar 100%.</p>
        )}
      </AdminCrudModal>
    </div>
  );
}
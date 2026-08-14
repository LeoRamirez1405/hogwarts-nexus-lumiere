"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { api, PackType, RouletteConfig, RouletteSegment, Reward, User, Album, PackTypeInput } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import {
  AdminCrudModal,
  FormField,
  InputField,
  TextareaField,
  SelectField,
} from "@/components/ui/AdminCrudModal";
import { AdminCrudTable, type ColumnDef } from "@/components/ui/AdminCrudTable";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import GlassCard from "@/components/ui/GlassCard";
import Avatar from "@/components/ui/Avatar";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import { MaterialIcon } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { mediaSrc } from "@/lib/media";
import { CardsEditorModal } from "./components/CardsEditorModal";
import type { AlbumCreateInput, AlbumStatus, AlbumUpdateInput } from "@/lib/api";

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activa",
  completed: "Completada",
};

const STATUS_COLOR: Record<AlbumStatus, "primary" | "secondary" | "error" | "success" | "default"> = {
  draft: "default",
  active: "secondary",
  completed: "primary",
};

const RARITIES = ["common", "rare", "ultra_rare", "special", "legendary"] as const;
const RARITY_LABEL: Record<string, string> = {
  common: "Común",
  rare: "Rara",
  ultra_rare: "Ultra Rara",
  special: "Especial",
  legendary: "Legendaria",
};

interface PackFormState {
  name: string;
  description: string;
  price_zerines: string;
  num_cards: string;
  weights: Record<string, string>;
  enabled: boolean;
}

interface SegmentDraft {
  prize: string;
  label: string;
  weight: string;
  pack_type_id: string;
}

const defaultPackForm = (): PackFormState => ({
  name: "",
  description: "",
  price_zerines: "50",
  num_cards: "5",
  weights: { common: "55", rare: "25", ultra_rare: "12", special: "6", legendary: "2" },
  enabled: true,
});

const defaultAlbumForm: AlbumCreateInput = {
  name: "",
  description: "",
  cover_url: "",
  starts_at: null,
  ends_at: null,
};

function draftToSegment(d: SegmentDraft): RouletteSegment {
  return {
    prize: d.prize,
    label: d.label.trim() || d.prize,
    weight: Math.max(1, parseInt(d.weight) || 0),
    pack_type_id: d.prize.startsWith("pack:") && d.pack_type_id ? d.pack_type_id : undefined,
  };
}

function kindOf(prize: string): string {
  if (prize.startsWith("pack:")) return "pack";
  if (prize.startsWith("zerines:")) return "zerines";
  if (prize.startsWith("xp:")) return "xp";
  if (prize.startsWith("spins:")) return "spins";
  return prize;
}

const SEGMENT_KIND_LABEL: Record<string, string> = {
  pack: "Sobre(s)",
  zerines: "Zerines",
  legendary: "Legendaria garantizada",
  none: "Nada (buen intento)",
  xp: "XP",
  spins: "Giro gratis",
};

const DEFAULT_SEGMENT: Record<string, { prize: string; label: string }> = {
  pack: { prize: "pack:1", label: "1 Sobre" },
  zerines: { prize: "zerines:100", label: "100 Zerines" },
  legendary: { prize: "legendary", label: "¡Legendaria garantizada!" },
  none: { prize: "none", label: "Buen intento, gira de nuevo" },
  xp: { prize: "xp:50", label: "50 XP" },
  spins: { prize: "spins:1", label: "1 Giro gratis" },
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type AdminTab = "albums" | "packs" | "roulette" | "rewards";

export default function AdminAlbumsConsolidatedPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<AdminTab>("albums");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  if (user?.role !== "admin") return null;

  const tabs: { id: AdminTab; label: string; icon: string; count?: number }[] = [
    { id: "albums", label: "Álbumes", icon: "auto_stories" },
    { id: "packs", label: "Tipos de Sobre", icon: "markunread_mailbox" },
    { id: "roulette", label: "Ruleta", icon: "casino" },
    { id: "rewards", label: "Recompensas", icon: "redeem" },
  ];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">Configuración del Álbum</h1>
          <p className="text-xs text-outline">
            Gestiona álbumes, sobres, ruleta y recompensas de admin.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 bg-surface-container-low rounded-xl p-1" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? "bg-surface text-primary shadow-sm"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high"
            }`}
          >
            <MaterialIcon name={tab.icon} className="text-lg" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "albums" && (
        <AlbumsTab debouncedSearch={debouncedSearch} setSearch={setSearch} />
      )}
      {activeTab === "packs" && <PacksTab debouncedSearch={debouncedSearch} setSearch={setSearch} />}
      {activeTab === "roulette" && <RouletteTab />}
      {activeTab === "rewards" && <RewardsTab />}
    </div>
  );
}

function AlbumsTab({ debouncedSearch, setSearch }: { debouncedSearch: string; setSearch: (v: string) => void }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState<AlbumCreateInput>(defaultAlbumForm);
  const [status, setStatus] = useState<AlbumStatus>("draft");
  const [showCreate, setShowCreate] = useState(false);
  const [editingCards, setEditingCards] = useState<Album | null>(null);

  const crud = useAdminCrud<Album, AlbumCreateInput, AlbumUpdateInput>({
    queryKey: ["admin-albums"],
    fetcher: (p) => api.listAlbums(p.skip, p.limit),
    createFn: (data) => api.createAlbum(data),
    updateFn: (id, data) => api.updateAlbum(id, data),
    deleteFn: (id) => api.deleteAlbum(id),
    getDisplayName: (a) => a.name,
    getId: (a) => a.id,
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: debouncedSearch,
    filterFn: (album, q) => album.name.toLowerCase().includes(q.toLowerCase()),
    defaultCreateForm: defaultAlbumForm,
    messages: {
      create: "Álbum creado",
      update: "Álbum actualizado",
      delete: "Álbum eliminado",
    },
  });

  const openNew = () => {
    setForm({ ...defaultAlbumForm, starts_at: null, ends_at: null });
    setStatus("draft");
    setShowCreate(true);
  };

  const openEdit = (album: Album) => {
    setForm({
      name: album.name,
      description: album.description ?? "",
      cover_url: album.cover_url ?? "",
      starts_at: album.starts_at ?? null,
      ends_at: album.ends_at ?? null,
    });
    setStatus(album.status);
    crud.setEditItem(album);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    const data: AlbumUpdateInput = {
      name: form.name.trim(),
      description: form.description?.trim() || undefined,
      cover_url: form.cover_url || undefined,
      starts_at: form.starts_at || undefined,
      ends_at: form.ends_at || undefined,
      status,
    };
    if (showCreate) {
      await crud.handleCreate(data as AlbumCreateInput);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    crud.refresh();
  };

  const columns: ColumnDef<Album>[] = [
    { key: "name", header: "Nombre", render: (a) => <span className="font-medium text-primary">{a.name}</span> },
    {
      key: "status",
      header: "Estado",
      render: (a) => <Badge color={STATUS_COLOR[a.status] ?? "default"}>{STATUS_LABEL[a.status] ?? a.status}</Badge>,
      hideOnMobile: true,
    },
    { key: "total_cards", header: "Cartas", render: (a) => <span className="font-mono text-sm">{a.total_cards}/25</span> },
    {
      key: "ends_at",
      header: "Cierre",
      render: (a) =>
        a.ends_at ? (
          <span className="text-xs text-outline">{new Date(a.ends_at).toLocaleDateString()}</span>
        ) : (
          <span className="text-xs text-outline">—</span>
        ),
      hideOnMobile: true,
    },
    {
      key: "cards",
      header: "",
      render: (a) => (
        <Button variant="ghost" size="sm" icon="edit_note" onClick={() => setEditingCards(a)}>
          Cartas
        </Button>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            value={debouncedSearch}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar álbum…"
            className="w-44 rounded-full border border-outline/20 bg-surface-container-low px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            onClick={openNew}
            icon="add"
            className="!py-2 !text-label-sm sm:!py-3 sm:!text-body-md"
          >
            Nuevo álbum
          </Button>
        </div>
      </div>

      <AdminCrudTable
        items={crud.filteredItems}
        columns={columns}
        onEdit={openEdit}
        onDelete={(id) => crud.handleDelete(id)}
        getId={(a) => a.id}
        loading={crud.loading}
        emptyMessage="No hay álbumes todavía"
        emptyIcon="auto_stories"
        hasMore={crud.hasMore}
        loadingMore={crud.loadingMore}
        totalLoaded={crud.totalLoaded}
        totalCount={crud.totalCount}
        onLoadMore={crud.loadMore}
        deleteConfirmTitle="Eliminar álbum"
        deleteConfirmMessage="Se borrará el álbum y sus cartas. Las colecciones de los usuarios quedarán huérfanas. Esta acción no se puede deshacer."
        className="mb-3"
      />

      <div className="flex justify-end">
        <p className="text-[11px] text-outline">
          Usa el botón &quot;Cartas&quot; de cada fila para subir las 25 figuritas.
        </p>
      </div>

      <AdminCrudModal
        open={showCreate || !!crud.editItem}
        onClose={() => {
          setShowCreate(false);
          crud.setEditItem(null);
        }}
        title={showCreate ? "Nuevo álbum" : "Editar álbum"}
        saving={crud.saving}
        saveDisabled={!form.name.trim()}
        onSave={handleSave}
      >
        <FormField label="Nombre" required>
          <InputField
            value={form.name}
            onChange={(v) => setForm({ ...form, name: v })}
            placeholder="Ej: Edición Inaugural — Torneo de Escobas"
            firstInput
          />
        </FormField>
        <FormField label="Descripción">
          <TextareaField
            value={form.description ?? ""}
            onChange={(v) => setForm({ ...form, description: v })}
            placeholder="Temática, reglas, fechas..."
          />
        </FormField>
        <FormField label="Portada">
          <AlbumCoverUpload value={form.cover_url ?? ""} onChange={(url) => setForm({ ...form, cover_url: url })} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Inicio">
            <input
              type="datetime-local"
              value={toLocalInput(form.starts_at)}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary"
            />
          </FormField>
          <FormField label="Cierre">
            <input
              type="datetime-local"
              value={toLocalInput(form.ends_at)}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none focus:border-primary"
            />
          </FormField>
        </div>
        {!showCreate && (
          <FormField label="Estado">
            <SelectField
              value={status}
              onChange={(v) => setStatus(v as AlbumStatus)}
              options={Object.entries(STATUS_LABEL).map(([value, label]) => ({ value, label }))}
            />
          </FormField>
        )}
        <p className="text-[11px] text-outline">
          Después de crear el álbum usa &quot;Editar cartas&quot; para subir las 25 figuritas.
        </p>
      </AdminCrudModal>

      {editingCards && (
        <CardsEditorModal album={editingCards} onClose={() => setEditingCards(null)} onSaved={() => crud.refresh()} />
      )}
    </>
  );
}

function PacksTab({ debouncedSearch, setSearch }: { debouncedSearch: string; setSearch: (v: string) => void }) {
  const { user } = useAuthStore();
  const [form, setForm] = useState<PackFormState>(defaultPackForm());
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

  const weightSum = RARITIES.reduce((acc, r) => acc + (parseInt(form.weights[r]) || 0), 0);
  const weightsValid = weightSum === 100;
  const formValid = !!form.name.trim() && parseInt(form.price_zerines) > 0 && parseInt(form.num_cards) > 0 && weightsValid;

  const openNew = () => {
    setForm(defaultPackForm());
    setShowCreate(true);
  };

  const openEdit = (pack: PackType) => {
    setForm({
      name: pack.name,
      description: pack.description ?? "",
      price_zerines: String(pack.price_zerines),
      num_cards: String(pack.num_cards),
      weights: Object.fromEntries(RARITIES.map((r) => [r, String(pack.rarity_weights?.[r] ?? 0)])),
      enabled: pack.enabled,
    });
    crud.setEditItem(pack);
  };

  const buildPayload = (): PackTypeInput => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    price_zerines: parseInt(form.price_zerines) || 0,
    num_cards: parseInt(form.num_cards) || 1,
    rarity_weights: Object.fromEntries(RARITIES.map((r) => [r, parseInt(form.weights[r]) || 0])),
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
    { key: "name", header: "Sobre", render: (p) => <span className="font-medium text-primary">{p.name}</span> },
    { key: "price", header: "Precio", render: (p) => <ZerineDisplay amount={p.price_zerines} variant="price" /> },
    { key: "num_cards", header: "Cartas", render: (p) => <span className="font-mono text-sm">{p.num_cards}</span>, hideOnMobile: true },
    {
      key: "enabled",
      header: "Estado",
      render: (p) => <Badge color={p.enabled ? "secondary" : "default"}>{p.enabled ? "Activo" : "Desactivado"}</Badge>,
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
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <input
            value={debouncedSearch}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar sobre…"
            className="w-44 rounded-full border border-outline/20 bg-surface-container-low px-4 py-2 text-sm outline-none focus:border-primary"
          />
          <Button
            onClick={openNew}
            icon="add"
            className="!py-2 !text-label-sm sm:!py-3 sm:!text-body-md"
          >
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
          <InputField value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ej: Sobre de Lechuza" firstInput />
        </FormField>
        <FormField label="Descripción">
          <TextareaField value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="Ej: 5 cartas de rareza estándar" />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Precio (Zerines)" required>
            <InputField type="number" value={form.price_zerines} onChange={(v) => setForm({ ...form, price_zerines: v })} />
          </FormField>
          <FormField label="Cartas por sobre" required>
            <InputField type="number" value={form.num_cards} onChange={(v) => setForm({ ...form, num_cards: v })} />
          </FormField>
        </div>

        <FormField
          label="Probabilidades de rareza (%)"
          required
          helpText={weightSum === 100 ? "Probabilidades correctas" : `La suma es ${weightSum}% — debe ser exactamente 100%`}
          error={weightsValid ? undefined : "La suma debe ser 100%"}
        >
          <div className="space-y-2">
            {RARITIES.map((rarity) => (
              <div key={rarity} className="flex items-center gap-3">
                <span className="w-24 text-xs text-outline">{RARITY_LABEL[rarity]}</span>
                <InputField
                  type="number"
                  value={form.weights[rarity] ?? "0"}
                  onChange={(v) => setForm({ ...form, weights: { ...form.weights, [rarity]: v } })}
                  className="!px-3 !py-1.5 !text-sm"
                />
                <span className="text-xs text-outline">%</span>
              </div>
            ))}
          </div>
        </FormField>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-primary">
          <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4 accent-[#0e3b60]" />
          Sobre disponible en la tienda
        </label>
        {!formValid && weightSum !== 100 && <p className="text-xs text-red-600">Revisa las probabilidades: deben sumar 100%.</p>}
      </AdminCrudModal>
    </>
  );
}

function RouletteTab() {
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [cost, setCost] = useState("100");
  const [enabled, setEnabled] = useState(true);
  const [segments, setSegments] = useState<SegmentDraft[]>([]);
  const [packTypes, setPackTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, store] = await Promise.all([api.getConfig(), api.getStore()]);
        if (cancelled) return;
        setConfig(cfg);
        setCost(String(cfg.cost_zerines));
        setEnabled(cfg.enabled);
        setSegments(
          cfg.segments.map((s) => ({
            prize: s.prize,
            label: s.label,
            weight: String(s.weight),
            pack_type_id: s.pack_type_id ?? "",
          }))
        );
        setPackTypes(store.pack_types.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar la configuración de la ruleta", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const valid = parseInt(cost) > 0 && segments.length > 0 && segments.every((s) => parseInt(s.weight) > 0);

  const addSegment = () => {
    setSegments((s) => [...s, { prize: "pack:1", label: "1 Sobre", weight: "10", pack_type_id: "" }]);
  };

  const updateSegment = (index: number, patch: Partial<SegmentDraft>) => {
    setSegments((s) => s.map((seg, i) => (i === index ? { ...seg, ...patch } : seg)));
  };

  const removeSegment = (index: number) => {
    setSegments((s) => s.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.updateRouletteConfig({
        cost_zerines: parseInt(cost) || 0,
        segments: segments.map(draftToSegment),
        enabled,
      });
      toastSuccess("Ruleta actualizada", "La configuración se guardó");
      setShowEditor(false);
      const cfg = await api.getConfig();
      setConfig(cfg);
      setCost(String(cfg.cost_zerines));
      setEnabled(cfg.enabled);
      setSegments(
        cfg.segments.map((s) => ({
          prize: s.prize,
          label: s.label,
          weight: String(s.weight),
          pack_type_id: s.pack_type_id ?? "",
        }))
      );
    } catch (e) {
      toastError("No se pudo guardar la ruleta", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          onClick={() => setShowEditor(true)}
          icon="tune"
          disabled={loading}
          className="!py-2 !text-label-sm sm:!py-3 sm:!text-body-md"
        >
          Editar configuración
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-outline">Cargando…</p>
      ) : (
        <GlassCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              Costo: <ZerineDisplay amount={config?.cost_zerines ?? 0} variant="price" size="sm" />
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${config?.enabled ? "bg-emerald-600/15 text-emerald-700" : "bg-outline/15 text-outline"}`}>
              {config?.enabled ? "Activa" : "Desactivada"}
            </span>
          </div>
          <p className="mb-2 text-xs uppercase tracking-widest text-outline">Segmentos</p>
          <ul className="space-y-2">
            {(config?.segments ?? []).map((seg, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
                <span className="font-medium text-primary">{seg.label}</span>
                <span className="font-mono text-[11px] text-outline">{seg.prize}</span>
                <span className="ml-auto font-mono text-xs text-outline">{seg.weight} pts</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <AdminCrudModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        title="Configurar ruleta"
        saving={saving}
        saveDisabled={!valid}
        saveLabel="Guardar ruleta"
        onSave={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Costo" required>
            <InputField type="number" value={cost} onChange={setCost} firstInput />
          </FormField>
          <FormField label="Estado">
            <select value={enabled ? "1" : "0"} onChange={(e) => setEnabled(e.target.value === "1")} className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md">
              <option value="1">Activa</option>
              <option value="0">Desactivada</option>
            </select>
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">Segmentos</p>
            <Button variant="secondary" size="sm" icon="add" onClick={addSegment}> Añadir </Button>
          </div>
          <p className="text-xs text-outline">
            El <span className="font-semibold text-on-surface">peso</span> es la probabilidad relativa del premio: a mayor número, más probable que salga en la ruleta.
          </p>
          {segments.map((seg, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-outline/15 bg-surface-container-low p-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={kindOf(seg.prize)}
                  onChange={(e) => {
                    const defaults = DEFAULT_SEGMENT[e.target.value];
                    updateSegment(i, { prize: defaults.prize, label: defaults.label, pack_type_id: "" });
                  }}
                  className="min-w-0 flex-1 basis-40 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                >
                  {Object.entries(SEGMENT_KIND_LABEL).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
                <span className="shrink-0 text-xs font-medium text-outline">Peso</span>
                <InputField type="number" value={seg.weight} onChange={(v) => updateSegment(i, { weight: v })} placeholder="Peso" className="!w-20 !px-2 !py-1.5 !text-sm" />
                <Button variant="ghost" size="sm" icon="delete" onClick={() => removeSegment(i)}> Quitar </Button>
              </div>
              {kindOf(seg.prize) === "pack" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <InputField type="number" value={seg.prize.split(":")[1] ?? "1"} onChange={(v) => updateSegment(i, { prize: `pack:${parseInt(v) || 1}` })} className="!w-20 !px-2 !py-1.5 !text-sm" />
                  <span className="text-xs text-outline">sobres</span>
                  <select value={seg.pack_type_id} onChange={(e) => updateSegment(i, { pack_type_id: e.target.value })} className="min-w-0 flex-1 basis-40 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm">
                    <option value="">Auto (sobre más barato)</option>
                    {packTypes.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
              ) : kindOf(seg.prize) === "zerines" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-outline">Cantidad:</span>
                  <InputField type="number" value={seg.prize.split(":")[1] ?? "100"} onChange={(v) => updateSegment(i, { prize: `zerines:${parseInt(v) || 0}` })} className="!w-24 !px-2 !py-1.5 !text-sm" />
                  <ZerineDisplay amount={1} variant="price" size="sm" />
                </div>
              ) : kindOf(seg.prize) === "xp" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-outline">XP:</span>
                  <InputField type="number" value={seg.prize.split(":")[1] ?? "50"} onChange={(v) => updateSegment(i, { prize: `xp:${parseInt(v) || 0}` })} className="!w-24 !px-2 !py-1.5 !text-sm" />
                  <span className="text-xs text-outline">puntos</span>
                </div>
              ) : kindOf(seg.prize) === "spins" ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-outline">Giros gratis:</span>
                  <InputField type="number" value={seg.prize.split(":")[1] ?? "1"} onChange={(v) => updateSegment(i, { prize: `spins:${parseInt(v) || 0}` })} className="!w-24 !px-2 !py-1.5 !text-sm" />
                </div>
              ) : null}
              <InputField value={seg.label} onChange={(v) => updateSegment(i, { label: v })} placeholder="Etiqueta visible (ej: 1 Sobre de Lechuza)" className="!px-2 !py-1.5 !text-sm" />
            </div>
          ))}
          {segments.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-outline"><MaterialIcon name="info" className="text-base" /> Sin segmentos la ruleta no puede girar.</p>
          )}
        </div>
      </AdminCrudModal>
    </>
  );
}

function RewardsTab() {
  const [packTypes, setPackTypes] = useState<PackType[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [packTypeId, setPackTypeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [granting, setGranting] = useState(false);
  const [history, setHistory] = useState<Reward[]>([]);
  const [historySkip, setHistorySkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    api.getStore().then((s) => setPackTypes(s.pack_types)).catch((e) => toastError("No se pudieron cargar los sobres", e));
  }, []);

  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await api.searchUsersServer(debouncedSearch.trim(), { limit: 6 });
        if (!cancelled) setResults(page.items);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudieron buscar usuarios", e);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedSearch]);

  const visibleResults = debouncedSearch.trim() ? results : [];

  const loadHistory = async (skip = 0) => {
    try {
      const page = await api.listRewards(skip, 15);
      setHistory((prev) => (skip === 0 ? page.items : [...prev, ...page.items]));
      setHistorySkip(skip + 15);
      setHasMore(page.has_more);
    } catch (e) {
      toastError("No se pudo cargar el historial", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.listRewards(0, 15);
        if (cancelled) return;
        setHistory(page.items);
        setHistorySkip(15);
        setHasMore(page.has_more);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar el historial", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const valid = selected.length > 0 && !!packTypeId && parseInt(quantity) >= 1 && parseInt(quantity) <= 100;

  const grant = async () => {
    if (!valid) return;
    setGranting(true);
    try {
      await api.grantRewards({
        user_ids: selected.map((u) => u.id),
        pack_type_id: packTypeId,
        quantity: parseInt(quantity),
        message: message.trim() || undefined,
      });
      toastSuccess("¡Sobres otorgados!", "Los búhos ya van en camino 🦉");
      setSelected([]);
      setSearch("");
      setMessage("");
      setHistory([]);
      loadHistory(0);
    } catch (e) {
      toastError("No se pudieron otorgar los sobres", e);
    } finally {
      setGranting(false);
    }
  };

  const packType = packTypes.find((p) => p.id === packTypeId);

  return (
    <>
      <GlassCard className="space-y-4 p-5">
        <FormField label="Buscar jugadores" helpText="Aparecen al escribir 2+ caracteres.">
          <InputField value={search} onChange={setSearch} placeholder="Nombre del jugador…" firstInput />
        </FormField>

        {visibleResults.length > 0 && (
          <ul className="space-y-1.5">
            {visibleResults.filter((r) => !selected.some((s) => s.id === r.id)).map((r) => (
              <li key={r.id}>
                <button onClick={() => { setSelected((s) => [...s, r]); setSearch(""); setResults([]); }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-container-high active:scale-[0.98]">
                  <Avatar src={r.avatar_url} initials={r.name.slice(0, 2).toUpperCase()} size="sm" />
                  <span className="flex-1 text-sm font-medium text-primary">{r.name}</span>
                  <MaterialIcon name="add_circle" className="text-secondary" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {selected.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-outline">Destinatarios ({selected.length})</p>
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span key={u.id} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs font-medium text-primary">
                  <Avatar src={u.avatar_url} initials={u.name.slice(0, 2).toUpperCase()} size="xs" />
                  {u.name}
                  <button onClick={() => setSelected((s) => s.filter((x) => x.id !== u.id))} aria-label={`Quitar a ${u.name}`} className="rounded-full p-0.5 hover:bg-primary/20"><MaterialIcon name="close" className="text-sm" /></button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Tipo de sobre" required>
            <select value={packTypeId} onChange={(e) => setPackTypeId(e.target.value)} className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md">
              <option value="">Seleccionar…</option>
              {packTypes.map((p) => (<option key={p.id} value={p.id} disabled={!p.enabled}>{p.name} — {p.price_zerines.toLocaleString()}💎 ({p.enabled ? "activo" : "desactivado"})</option>))}
            </select>
          </FormField>
          <FormField label="Cantidad (1-100)" required>
            <InputField type="number" value={quantity} onChange={setQuantity} placeholder="1" />
          </FormField>
        </div>

        <FormField label="Mensaje del búho (opcional)">
          <TextareaField value={message} onChange={setMessage} placeholder="Ej: ¡Buen partido ayer! Te va a hacer falta esto…" rows={2} />
        </FormField>

        <Button className="w-full sm:w-auto" disabled={!valid || granting} onClick={grant} icon="redeem">
          {valid ? `Otorgar ${quantity} × ${packType?.name ?? "sobre"} a ${selected.length} jugador${selected.length === 1 ? "" : "es"}` : "Completa la selección"}
        </Button>
      </GlassCard>

      <section>
        <h2 className="mb-3 font-display text-lg text-primary">Historial de recompensas</h2>
        {history.length === 0 ? (
          <p className="text-sm text-outline">Todavía no hay recompensas otorgadas.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {history.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                  <Avatar src={undefined} initials={r.user_name.slice(0, 2).toUpperCase()} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">{r.user_name} ← {r.admin_name}</p>
                    <p className="truncate text-[11px] text-outline">{r.quantity} × {r.pack_type_name} {r.message ? ` · "${r.message}"` : ""}</p>
                  </div>
                  <span className="shrink-0 text-[10px] text-outline">{new Date(r.created_at).toLocaleString()}</span>
                </li>
              ))}
            </ul>
            {hasMore && <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => loadHistory(historySkip)}>Ver más</Button>}
          </>
        )}
      </section>
    </>
  );
}

function AlbumCoverUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      onChange(result.url);
      toastSuccess("Portada subida");
    } catch {
      toastError("No se pudo subir la portada");
    }
    setUploading(false);
    e.target.value = "";
  };
  return (
    <div className="flex items-center gap-3">
      {value && (
        <Image
          src={mediaSrc(value)}
          alt="Portada del álbum"
          width={112}
          height={80}
          className="h-20 w-28 shrink-0 rounded-xl border border-outline/20 object-cover"
          unoptimized
        />
      )}
      <div className="flex flex-col items-center gap-1">
        <label className="flex w-28 cursor-pointer flex-col items-center gap-1 rounded-xl border border-dashed border-outline/40 p-3 hover:border-primary">
          <MaterialIcon name="image" className="text-2xl text-outline" />
          <span className="text-[10px] text-outline">
            {uploading ? "Subiendo..." : value ? "Cambiar" : "Portada"}
          </span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFile} disabled={uploading} />
        </label>
        {value && (
          <Button variant="ghost" size="sm" icon="delete" onClick={() => onChange("")}> Quitar </Button>
        )}
      </div>
    </div>
  );
}
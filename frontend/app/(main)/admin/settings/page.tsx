"use client";

import { useState, useEffect } from "react";
import { api, EnumCategory, EnumValue, FeatureFlag } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useFeatureFlagStore } from "@/lib/featureFlagStore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import Modal from "@/components/ui/Modal";
import Switch from "@/components/ui/Switch";
import ListFooter from "@/components/ui/ListFooter";
import { usePaginatedList } from "@/hooks/usePaginatedList";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  pet_type: "pets",
  book_category: "menu_book",
  article_category: "article",
  borgin_category: "dark_mode",
};

const SYSTEM_CATEGORIES = ["pet_type", "book_category", "article_category", "borgin_category"];

export default function AdminSettingsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const setFlagInStore = useFeatureFlagStore((s) => s.setFlag);

  const {
    items: allItems,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
  } = usePaginatedList({
    fetcher: async (p) => {
      const cats = await api.getEnumCategories(p);
      return cats;
    },
    pageSize: 10,
    enabled: true,
  });
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  // Feature flags
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagUpdating, setFlagUpdating] = useState<string | null>(null);

  useEffect(() => {
    api
      .getFeatureFlags()
      .then(({ items }) => setFlags(items))
      .catch(() => {})
      .finally(() => setFlagsLoading(false));
  }, []);

  const handleToggleFlag = async (flag: FeatureFlag) => {
    setFlagUpdating(flag.key);
    try {
      const updated = await api.updateFeatureFlag(flag.key, {
        enabled: !flag.enabled,
      });
      setFlags((prev) =>
        prev.map((f) => (f.key === flag.key ? updated : f))
      );
      setFlagInStore(updated);
    } catch {}
    setFlagUpdating(null);
  };

  const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
    dashboard: { label: "Dashboard", icon: "dashboard" },
    treasury: { label: "Tesorería", icon: "diamond" },
    pets: { label: "Mascotas", icon: "pets" },
  };

  // Create/Edit Category
  const [editCategory, setEditCategory] = useState<EnumCategory | null>(null);
  const [isNewCategory, setIsNewCategory] = useState(false);
  const [catForm, setCatForm] = useState({ code: "", name: "", description: "" });
  const [savingCategory, setSavingCategory] = useState(false);

  // Create/Edit Value
  const [editValue, setEditValue] = useState<EnumValue | null>(null);
  const [isNewValue, setIsNewValue] = useState(false);
  const [valForm, setValForm] = useState({ label: "", description: "" });
  const [savingValue, setSavingValue] = useState(false);

  const filteredCategories = allItems.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  // Derive the effectively active category id: prefer user selection, fallback to first
  const effectiveActiveId =
    activeCategoryId && allItems.some((c) => c.id === activeCategoryId)
      ? activeCategoryId
      : allItems.length > 0
        ? allItems[0].id
        : null;
  const activeCategory = allItems.find((c) => c.id === effectiveActiveId);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  const visibleCategories = filteredCategories;

  const openNewCategory = () => {
    setIsNewCategory(true);
    setEditCategory(null);
    setCatForm({ code: "", name: "", description: "" });
  };

  const handleSaveCategory = async () => {
    setSavingCategory(true);
    try {
      const data = {
        code: catForm.code,
        name: catForm.name,
        description: catForm.description || undefined,
      };
      if (isNewCategory) {
        const created = await api.createEnumCategory(data);
        refresh();
        setActiveCategoryId(created.id);
      } else if (editCategory) {
        await api.updateEnumCategory(editCategory.id, data);
        refresh();
      }
      setEditCategory(null);
      setIsNewCategory(false);
    } catch {}
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
        refresh();
      } else if (editValue) {
        await api.updateEnumValue(editValue.id, data);
        refresh();
      }
      setEditValue(null);
      setIsNewValue(false);
    } catch {}
    setSavingValue(false);
  };

  const handleDeleteValue = async (valueId: string) => {
    if (!confirm("Eliminar este valor?")) return;
    try {
      await api.deleteEnumValue(valueId);
      refresh();
    } catch {}
  };

  const isSystemCategory = (code: string) => SYSTEM_CATEGORIES.includes(code);

  if (user?.role !== "admin") return null;

  return (
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
      <GlassCard>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center">
              <MaterialIcon name="toggle_on" className="text-xl text-on-tertiary" />
            </div>
            <div>
              <h2 className="font-display text-title-md text-on-surface">Visibilidad de Secciones</h2>
              <p className="text-label-sm text-on-surface-variant">
                Activa o desactiva secciones específicas de la plataforma. Los cambios se reflejan inmediatamente para todos los usuarios.
              </p>
            </div>
          </div>

          {flagsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-outline-variant/20 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : flags.length === 0 ? (
            <div className="text-center py-8">
              <MaterialIcon name="toggle_off" className="text-4xl text-outline-variant mb-2 block mx-auto" />
              <p className="text-on-surface-variant text-body-md">No hay feature flags configurados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flags.map((flag) => {
                const meta = flag.category ? CATEGORY_LABELS[flag.category] : null;
                return (
                  <div
                    key={flag.key}
                    className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                        <MaterialIcon
                          name={meta?.icon || "toggle_on"}
                          className="text-lg text-on-surface-variant"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-body-md text-on-surface">{flag.name}</p>
                          {meta && (
                            <Badge variant="tag" color="default">{meta.label}</Badge>
                          )}
                          {flag.enabled && (
                            <Badge variant="tag" color="primary">Activo</Badge>
                          )}
                        </div>
                        {flag.description && (
                          <p className="text-label-sm text-on-surface-variant mt-1">{flag.description}</p>
                        )}
                      </div>
                    </div>
                    <Switch
                      checked={flag.enabled}
                      onChange={() => handleToggleFlag(flag)}
                      disabled={flagUpdating === flag.key}
                      label={flag.name}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </GlassCard>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-outline-variant/30 rounded w-1/3 mb-4" />
              <div className="h-3 bg-outline-variant/30 rounded w-full" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Categories */}
          <GlassCard className="lg:col-span-1 flex flex-col">
            <div className="p-4 border-b border-outline-variant/20">
              <h2 className="font-display text-title-md text-on-surface">Categorías</h2>
            </div>
            <div className="p-2">
              <SearchBar
                placeholder="Buscar categorías..."
                value={search}
                onChange={setSearch}
                size="sm"
                className="mb-4"
              />
              <Button variant="primary" icon="add" size="sm" onClick={openNewCategory} className="w-full mb-4">
                Nueva Categoría
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveCategoryId(c.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    effectiveActiveId === c.id
                      ? "bg-primary/10 text-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MaterialIcon name={CATEGORY_ICONS[c.code] || "category"} className="text-xl" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-body-md truncate">{c.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{c.code}</p>
                    </div>
                    <span className="text-label-sm text-on-surface-variant">
                      {c.values.length} valores
                    </span>
                  </div>
                </button>
              ))}
              {filteredCategories.length === 0 && (
                <div className="p-8 text-center">
                  <MaterialIcon name="category" className="text-4xl text-outline-variant mb-2 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">No se encontraron categorías</p>
                </div>
              )}
            </div>
            <div className="p-2 border-t border-outline-variant/20">
              <ListFooter
                hasMore={hasMore}
                loading={loadingMore}
                pageSize={10}
                loaded={totalLoaded}
                total={totalCount}
                onLoadMore={loadMore}
              />
            </div>
          </GlassCard>

          {/* Main - Values */}
          <GlassCard className="lg:col-span-3 flex flex-col">
            {activeCategory ? (
              <>
                <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <MaterialIcon name={CATEGORY_ICONS[activeCategory.code] || "category"} className="text-2xl text-primary" filled />
                    <div>
                      <h2 className="font-display text-headline-lg text-on-surface">{activeCategory.name}</h2>
                      <p className="text-label-sm text-on-surface-variant">{activeCategory.description}</p>
                    </div>
                    {isSystemCategory(activeCategory.code) && <Badge variant="tag" color="default">Sistema</Badge>}
                  </div>
                  <Button variant="primary" icon="add" onClick={openNewValue} disabled={!effectiveActiveId}>
                    Nuevo Valor
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {activeCategory.values.length === 0 ? (
                    <div className="text-center py-16">
                      <MaterialIcon name="category" className="text-4xl text-outline-variant mb-3 block mx-auto" />
                      <p className="text-on-surface-variant text-body-md">No hay valores en esta categoría</p>
                      <p className="text-label-sm text-on-surface-variant mt-1">Haz clic en Nuevo Valor para agregar uno</p>
                    </div>
                  ) : (
                    <ValuesList
                      key={effectiveActiveId}
                      values={activeCategory.values}
                      onEdit={openEditValue}
                      onDelete={handleDeleteValue}
                    />
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MaterialIcon name="settings" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                  <p className="text-on-surface-variant text-body-lg">Selecciona una categoría</p>
                  <p className="text-label-sm text-on-surface-variant mt-1">para gestionar sus valores</p>
                </div>
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Edit Category Modal */}
      {(editCategory || isNewCategory) && (
        <Modal open onClose={() => { setEditCategory(null); setIsNewCategory(false); }}>
          <div className="p-6 space-y-5 max-w-md">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNewCategory ? "Nueva Categoría" : "Editar Categoría"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Código</label>
                <input
                  type="text"
                  value={catForm.code}
                  onChange={(e) => setCatForm((p) => ({ ...p, code: e.target.value }))}
                  disabled={!isNewCategory}
                  className={`w-full px-4 py-3 rounded-xl text-body-md text-on-surface outline-none focus:border-primary transition-colors ${
                    isNewCategory
                      ? "bg-surface-container-low border border-outline-variant/20"
                      : "bg-surface-container-highest border border-transparent text-on-surface-variant cursor-not-allowed"
                  }`}
                  placeholder="ej: pet_type"
                />
                {!isNewCategory && <p className="text-label-sm text-on-surface-variant mt-1">El código no se puede cambiar</p>}
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
                <input
                  type="text"
                  value={catForm.name}
                  onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                  placeholder="ej: Tipo de Mascota"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Descripción</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-[80px] resize-none"
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setEditCategory(null); setIsNewCategory(false); }} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSaveCategory} disabled={savingCategory || !catForm.code || !catForm.name} className="flex-1">
                {savingCategory ? "Guardando..." : isNewCategory ? "Crear" : "Guardar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Value Modal */}
      {(editValue || isNewValue) && (
        <Modal open onClose={() => { setEditValue(null); setIsNewValue(false); }}>
          <div className="p-6 space-y-5 max-w-md">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNewValue ? "Nuevo Valor" : "Editar Valor"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Etiqueta</label>
                <input
                  type="text"
                  value={valForm.label}
                  onChange={(e) => setValForm((p) => ({ ...p, label: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                  placeholder="ej: Gryffindor"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Descripción</label>
                <textarea
                  value={valForm.description}
                  onChange={(e) => setValForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-[80px] resize-none"
                  placeholder="Descripción opcional"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" onClick={() => { setEditValue(null); setIsNewValue(false); }} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSaveValue} disabled={savingValue || !valForm.label} className="flex-1">
                {savingValue ? "Guardando..." : isNewValue ? "Crear" : "Guardar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// Value list
interface ValuesListProps {
  values: EnumValue[];
  onEdit: (v: EnumValue) => void;
  onDelete: (id: string) => void;
}

function ValuesList({ values, onEdit, onDelete }: ValuesListProps) {
  return (
    <div className="space-y-2">
      {values.map((v) => (
        <div
          key={v.id}
          className="glass-card rounded-xl p-4 flex items-center gap-4 transition-all"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-body-md text-on-surface truncate">{v.label}</span>
            </div>
            {v.description && (
              <p className="text-label-sm text-on-surface-variant truncate mt-1">{v.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(v)}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
              title="Editar"
            >
              <MaterialIcon name="edit" className="text-lg" />
            </button>
            <button
              onClick={() => onDelete(v.id)}
              className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
              title="Eliminar"
            >
              <MaterialIcon name="delete" className="text-lg" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
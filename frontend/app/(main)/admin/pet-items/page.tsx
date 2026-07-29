"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, PetItem, PetType, PetItemKind } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import Modal from "@/components/ui/Modal";
import ListFooter from "@/components/ui/ListFooter";
import { useCollapsibleList } from "@/hooks/useCollapsibleList";

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

const KIND_LABELS: Record<PetItemKind, string> = {
  food: "Comida",
  toy: "Juguete",
};

type Filter = "all" | PetItemKind;

export default function AdminPetItemsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [items, setItems] = useState<PetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editItem, setEditItem] = useState<PetItem | null>(null);
  const [isNew, setIsNew] = useState(false);
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
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    api
      .getPetItems()
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  const filtered = items.filter((it) => {
    const matchesSearch =
      !search ||
      it.name.toLowerCase().includes(search.toLowerCase()) ||
      it.pet_type.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "all" || it.kind === filter;
    return matchesSearch && matchesFilter;
  });

  const { visibleItems: visibleItemsList, ...itemList } = useCollapsibleList(filtered, 12);

  const openNew = () => {
    setIsNew(true);
    setEditItem(null);
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
  };

  const openEdit = (it: PetItem) => {
    setIsNew(false);
    setEditItem(it);
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
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        kind: form.kind,
        pet_type: form.pet_type,
        price: parseInt(form.price) || 0,
        restore_amount: Math.max(1, parseInt(form.restore_amount) || 10),
        pack_size: Math.max(1, parseInt(form.pack_size) || 1),
        image_url: form.image_url || undefined,
      };
      if (isNew) {
        const created = await api.createPetItem(data);
        setItems((prev) => [...prev, created]);
      } else if (editItem) {
        const updated = await api.updatePetItem(editItem.id, data);
        setItems((prev) => prev.map((it) => (it.id === updated.id ? updated : it)));
      }
      setEditItem(null);
      setIsNew(false);
    } catch {}
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await api.uploadFile(file);
      setForm((p) => ({ ...p, image_url: result.url }));
    } catch {}
    setUploadingImage(false);
    e.target.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este objeto?")) return;
    try {
      await api.deletePetItem(id);
      setItems((prev) => prev.filter((it) => it.id !== id));
    } catch {}
  };

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Comida y Juguetes
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            {items.length} objetos de mascota en catalogo
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Buscar objetos..."
            value={search}
            onChange={setSearch}
            size="sm"
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

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="h-4 bg-outline-variant/30 rounded w-2/3 mb-2" />
              <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <>
        <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${itemList.expanded ? "max-h-[75vh] overflow-y-auto pr-1" : ""}`}>
          {visibleItemsList.map((it) => (
            <GlassCard key={it.id} className="overflow-hidden" hover>
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
                      className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <MaterialIcon name="edit" className="text-lg" />
                    </button>
                    <button
                      onClick={() => handleDelete(it.id)}
                      className="p-1.5 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
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
                    💎 {it.price.toLocaleString()}
                  </p>
                  <p className="text-label-sm text-success font-medium">
                    +{it.restore_amount} {it.kind === "food" ? "hambre" : "felicidad"}
                  </p>
                </div>
                <p className="text-label-sm text-on-surface-variant">
                  Lote: {it.pack_size} {it.pack_size === 1 ? "unidad" : "unidades"} por compra
                </p>
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 && (
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
        <ListFooter {...itemList} onToggle={itemList.toggle} />
        </>
      )}

      {/* Create/Edit Modal */}
      {(editItem || isNew) && (
        <Modal open onClose={() => { setEditItem(null); setIsNew(false); }}>
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNew ? "Nuevo Objeto" : "Editar Objeto"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Descripcion</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-[80px] resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Tipo de objeto</label>
                  <div className="flex gap-2">
                    <button onClick={() => setForm((p) => ({ ...p, kind: "food" }))} className={`flex-1 py-2.5 rounded-xl text-label-sm font-medium border transition-all ${form.kind === "food" ? "bg-success text-on-success border-success" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20"}`}>Comida</button>
                    <button onClick={() => setForm((p) => ({ ...p, kind: "toy" }))} className={`flex-1 py-2.5 rounded-xl text-label-sm font-medium border transition-all ${form.kind === "toy" ? "bg-primary text-on-primary border-primary" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20"}`}>Juguete</button>
                  </div>
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Tipo de mascota</label>
                  <select value={form.pet_type} onChange={(e) => setForm((p) => ({ ...p, pet_type: e.target.value as PetType }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors">
                    <option value="Aves">Aves</option>
                    <option value="Bestias">Bestias</option>
                    <option value="Criaturas pequeñas">Criaturas pequeñas</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Precio</label>
                  <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Restaura</label>
                  <input type="number" value={form.restore_amount} onChange={(e) => setForm((p) => ({ ...p, restore_amount: e.target.value }))} placeholder="1-100" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Lote (uds.)</label>
                  <input type="number" value={form.pack_size} onChange={(e) => setForm((p) => ({ ...p, pack_size: e.target.value }))} placeholder="1" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <p className="text-label-sm text-on-surface-variant -mt-2">
                &quot;Restaura&quot; es cuanto sube la estadistica por uso. &quot;Lote&quot; es cuantas unidades recibe el comprador por compra.
              </p>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Imagen (opcional)</label>
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
                      capture="environment"
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
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => { setEditItem(null); setIsNew(false); }} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !form.name} className="flex-1">{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

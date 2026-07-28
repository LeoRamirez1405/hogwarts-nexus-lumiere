"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, Creature } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import Modal from "@/components/ui/Modal";

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

export default function AdminCreaturesPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [creatures, setCreatures] = useState<Creature[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editCreature, setEditCreature] = useState<Creature | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    rarity: "common" as Creature["rarity"],
    pet_type: "critter" as Creature["pet_type"],
    price: "",
    image_url: "",
    required_user_level: "",
    required_sanctuary_level: "",
    ability: "",
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
      .getCreatures()
      .then(setCreatures)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user, router]);

  const filtered = creatures.filter(
    (c) =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.rarity.toLowerCase().includes(search.toLowerCase())
  );

  const openNew = () => {
    setIsNew(true);
    setEditCreature(null);
    setForm({
      name: "",
      description: "",
      rarity: "common",
      pet_type: "critter",
      price: "",
      image_url: "",
      required_user_level: "",
      required_sanctuary_level: "",
      ability: "",
    });
  };

  const openEdit = (c: Creature) => {
    setIsNew(false);
    setEditCreature(c);
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
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
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
      if (isNew) {
        const created = await api.createCreature(data);
        setCreatures((prev) => [...prev, created]);
      } else if (editCreature) {
        const updated = await api.updateCreature(editCreature.id, data);
        setCreatures((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c))
        );
      }
      setEditCreature(null);
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

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Gestionar Criaturas
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            {creatures.length} criaturas en el Santuario
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Buscar criaturas..."
            value={search}
            onChange={setSearch}
            size="sm"
          />
          <Button variant="primary" icon="add" onClick={openNew}>
            Nueva Criatura
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass-card rounded-xl p-6 animate-pulse">
              <div className="h-40 bg-outline-variant/30 rounded-xl mb-4" />
              <div className="h-4 bg-outline-variant/30 rounded w-2/3 mb-2" />
              <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((c) => (
            <GlassCard key={c.id} className="overflow-hidden" hover>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="rarity" color={RARITY_COLORS[c.rarity] as "default" | "secondary" | "primary" | "error" | "success"}>
                    {RARITY_LABELS[c.rarity] || c.rarity}
                  </Badge>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
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
                    💎 {c.price.toLocaleString()}
                  </p>
                  <p className="text-label-sm text-on-surface-variant capitalize">
                    {RARITY_LABELS[c.rarity] || c.rarity}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 && (
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
      )}

      {(editCreature || isNew) && (
        <Modal open onClose={() => { setEditCreature(null); setIsNew(false); }}>
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNew ? "Nueva Criatura" : "Editar Criatura"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
                <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Descripcion</label>
                <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Precio</label>
                  <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Rareza</label>
                  <select value={form.rarity} onChange={(e) => setForm((p) => ({ ...p, rarity: e.target.value as Creature["rarity"] }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors">
                    <option value="common">Comun</option>
                    <option value="uncommon">Poco Comun</option>
                    <option value="rare">Raro</option>
                    <option value="legendary">Legendario</option>
                    <option value="ethereal">Etereo</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Tipo de mascota</label>
                <select value={form.pet_type} onChange={(e) => setForm((p) => ({ ...p, pet_type: e.target.value as Creature["pet_type"] }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors">
                  <option value="avian">Aves</option>
                  <option value="beast">Bestias</option>
                  <option value="critter">Criaturas pequenas</option>
                </select>
                <p className="text-label-sm text-on-surface-variant mt-1">Determina que comida y juguetes acepta.</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nivel magico req.</label>
                  <input type="number" min={1} value={form.required_user_level} onChange={(e) => setForm((p) => ({ ...p, required_user_level: e.target.value }))} placeholder="1 = sin requisito" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nivel santuario req.</label>
                  <input type="number" min={0} value={form.required_sanctuary_level} onChange={(e) => setForm((p) => ({ ...p, required_sanctuary_level: e.target.value }))} placeholder="0 = sin requisito" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Habilidad especial</label>
                <input type="text" value={form.ability} onChange={(e) => setForm((p) => ({ ...p, ability: e.target.value }))} placeholder="Ej: Doble de Zerines al cuidar" className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                <p className="text-label-sm text-on-surface-variant mt-1">Beneficio que comparten todas las mascotas de esta especie.</p>
              </div>
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
                      className="hidden"
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
              <Button variant="secondary" onClick={() => { setEditCreature(null); setIsNew(false); }} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !form.name} className="flex-1">{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

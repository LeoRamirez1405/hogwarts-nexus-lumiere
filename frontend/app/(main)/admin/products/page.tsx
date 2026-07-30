"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, Product, EnumValue } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import SearchBar from "@/components/ui/SearchBar";
import Modal from "@/components/ui/Modal";
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

export default function AdminProductsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "borgin" | "flourish">("all");
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category: "",
    shop: "borgin" as "borgin" | "flourish",
    image_url: "",
    stock: "",
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [borginCategories, setBorginCategories] = useState<EnumValue[]>([]);
  const [flourishCategories, setFlourishCategories] = useState<EnumValue[]>([]);

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
    fetcher: (p) => api.getProducts(filter === "all" ? undefined : filter, p),
    pageSize: 12,
    enabled: user?.role === "admin",
    resetKey: filter,
  });

  useEffect(() => {
    if (user?.role !== "admin") {
      router.push("/dashboard");
      return;
    }
    api.getEnumCategoryByCode("borgin_category").then((c) => {
      if (c) setBorginCategories(c.values);
    }).catch(() => {});
    api.getEnumCategoryByCode("book_category").then((c) => {
      if (c) setFlourishCategories(c.values);
    }).catch(() => {});
  }, [user, router]);

  const filtered = allItems.filter(
    (p) =>
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase()),
  );

  const visibleProducts = filtered;

  const openNew = () => {
    setIsNew(true);
    setForm({
      name: "",
      description: "",
      price: "",
      category: "",
      shop: "borgin",
      image_url: "",
      stock: "",
    });
    setEditProduct(null);
  };

  const openEdit = (p: Product) => {
    setIsNew(false);
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      category: p.category,
      shop: p.shop,
      image_url: p.image_url || "",
      stock: p.stock.toString(),
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        name: form.name,
        description: form.description,
        price: parseInt(form.price) || 0,
        category: form.category,
        shop: form.shop,
        image_url: form.image_url || undefined,
        stock: parseInt(form.stock) || 0,
      };
      if (isNew) {
        await api.createProduct(data);
      } else if (editProduct) {
        await api.updateProduct(editProduct.id, data);
      }
      refresh();
      setEditProduct(null);
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
    if (!confirm("Eliminar este producto?")) return;
    try {
      await api.deleteProduct(id);
      refresh();
    } catch {}
  };

  if (user?.role !== "admin") return null;

  // The backend already returns the count for the active `shop` filter.
  const getDisplayCount = () => totalCount;

  const getDisplayLabel = () => {
    if (filter === "all") return "productos en catálogo";
    return `${filter === "borgin" ? "Borgin & Burkes" : "Flourish & Blotts"} en catálogo`;
  };

  return (
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
          <Button variant="primary" icon="add" onClick={openNew}>
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
        <>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleProducts.map((p) => (
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
                      onClick={() => openEdit(p)}
                      className="p-1.5 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <MaterialIcon name="edit" className="text-lg" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
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
                    <MaterialIcon name="diamond" className="text-[1em] text-secondary" filled /> {p.price.toLocaleString()}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    Stock: {p.stock}
                  </p>
                </div>
              </div>
            </GlassCard>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16">
              <MaterialIcon
                name="inventory_2"
                className="text-5xl text-outline-variant mb-3 block mx-auto"
              />
              <p className="text-on-surface-variant text-body-md">
                No se encontraron productos
              </p>
            </div>
          )}
        </div>
        <ListFooter
          hasMore={hasMore}
          loading={loadingMore}
          pageSize={12}
          loaded={totalLoaded}
          total={totalCount}
          onLoadMore={loadMore}
        />
        </>
      )}

      {/* Create/Edit Modal */}
      {(editProduct || isNew) && (
        <Modal open onClose={() => { setEditProduct(null); setIsNew(false); }}>
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNew ? "Nuevo Producto" : "Editar Producto"}
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
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Precio</label>
                  <input type="number" value={form.price} onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Stock</label>
                  <input type="number" value={form.stock} onChange={(e) => setForm((p) => ({ ...p, stock: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Tienda</label>
                  <div className="flex gap-2">
                    <button onClick={() => setForm((p) => ({ ...p, shop: "borgin" as const, category: "" }))} className={`flex-1 py-2.5 rounded-xl text-label-sm font-medium border transition-all ${form.shop === "borgin" ? "bg-inverse-surface text-inverse-on-surface border-inverse-surface" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20"}`}>Borgin</button>
                    <button onClick={() => setForm((p) => ({ ...p, shop: "flourish" as const, category: "" }))} className={`flex-1 py-2.5 rounded-xl text-label-sm font-medium border transition-all ${form.shop === "flourish" ? "bg-primary text-on-primary border-primary" : "bg-surface-container-low text-on-surface-variant border-outline-variant/20"}`}>Flourish</button>
                  </div>
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Categoria</label>
                  <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors">
                    <option value="">Seleccionar...</option>
                    {(form.shop === "borgin" ? borginCategories : flourishCategories).map((cat) => (
                      <option key={cat.label} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>
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
              <Button variant="secondary" onClick={() => { setEditProduct(null); setIsNew(false); }} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSave} disabled={saving || !form.name} className="flex-1">{saving ? "Guardando..." : "Guardar"}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

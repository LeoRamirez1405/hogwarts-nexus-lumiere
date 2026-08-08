"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, Article, EnumValue } from "@/lib/api";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { useDebounce } from "@/hooks/useDebounce";
import { AdminCrudModal, FormField, InputField, TextareaField, SelectField } from "@/components/ui/AdminCrudModal";
import ListFooter from "@/components/ui/ListFooter";
import Switch from "@/components/ui/Switch";
import Button from "@/components/ui/Button";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { EnumMissingNotice } from "@/components/ui/EnumMissingNotice";

interface ArticlesTabProps {
  search: string;
  setSearch: (v: string) => void;
}

export function ArticlesTab({ search, setSearch }: ArticlesTabProps) {
  const [articleCategories, setArticleCategories] = useState<EnumValue[]>([]);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "",
    image_url: "",
    featured: false,
    pinned: false,
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getEnumCategoryByCode("article_category").then((cat) => {
      if (cat) setArticleCategories(cat.values);
    }).catch((e) => toastError("No se pudo cargar las categorías", e));
  }, []);

  const debouncedSearch = useDebounce(search, 300);

  const crud = useAdminCrud<Article, Partial<Article>, Partial<Article>>({
    queryKey: ["admin-articles"],
    fetcher: (p) =>
      api.getArticles({
        offset: String(p.skip),
        limit: String(p.limit),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      }),
    createFn: (data) => api.createArticle(data),
    updateFn: (id, data) => api.updateArticle(id, data),
    deleteFn: (id) => api.deleteArticle(id),
    getDisplayName: (a) => a.title,
    getId: (a) => a.id,
    pageSize: 10,
    enabled: true,
    resetKey: debouncedSearch,
    messages: {
      create: "Artículo creado",
      update: "Artículo actualizado",
      delete: "Artículo eliminado",
    },
  });

  const openNew = () => {
    setForm({
      title: "",
      body: "",
      category: "",
      image_url: "",
      featured: false,
      pinned: false,
    });
    crud.setShowCreate(true);
  };

  const openEdit = (a: Article) => {
    setForm({
      title: a.title,
      body: a.body,
      category: a.category,
      image_url: a.image_url || "",
      featured: a.featured,
      pinned: a.pinned ?? false,
    });
    crud.setEditItem(a);
  };

  const handleSave = async () => {
    const data = {
      title: form.title,
      body: form.body,
      category: form.category,
      image_url: form.image_url || undefined,
      featured: form.featured,
      pinned: form.pinned,
    };
    if (crud.showCreate) {
      await crud.handleCreate(data);
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, data);
    }
    setForm({
      title: "",
      body: "",
      category: "",
      image_url: "",
      featured: false,
      pinned: false,
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await api.uploadFile(file);
      setForm((f) => ({ ...f, image_url: result.url }));
      toastSuccess("Imagen subida");
    } catch (e) {
      toastError("No se pudo subir la imagen", e);
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <input
          type="text"
          placeholder="Buscar artículos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-64 px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
        />
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
        >
          <MaterialIcon name="add" className="text-[1.2em]" />
          Nuevo Artículo
        </button>
      </div>

      {crud.loading ? (
        <div className="text-center py-16">
          <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3 block mx-auto" />
          <p className="text-on-surface-variant text-body-md">Cargando...</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {crud.filteredItems.map((a) => (
              <div
                key={a.id}
                className="glass-card rounded-xl p-6 hover:bg-surface-container-high transition-colors flex flex-col md:flex-row md:items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-label-sm bg-surface-container-high text-on-surface-variant border border-outline-variant/20">{a.category}</span>
                    {a.pinned && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-label-sm bg-primary/10 text-primary border border-primary/30">
                        <MaterialIcon name="push_pin" className="text-[0.9em]" filled />
                        Principal
                      </span>
                    )}
                    {a.featured && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded text-label-sm bg-secondary/10 text-secondary border border-secondary/30">
                        Destacado
                      </span>
                    )}
                  </div>
                  <h3 className="font-display text-title-md text-on-surface mb-1">{a.title}</h3>
                  <p className="text-label-sm text-on-surface-variant line-clamp-1">{a.body.slice(0, 150)}{a.body.length > 150 ? "..." : ""}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                    title="Editar"
                  >
                    <MaterialIcon name="edit" className="text-lg" />
                  </button>
                  <button
                    onClick={() => crud.handleDelete(a.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                    title="Eliminar"
                  >
                    <MaterialIcon name="delete" className="text-lg" />
                  </button>
                </div>
              </div>
            ))}
            {crud.filteredItems.length === 0 && (
              <div className="text-center py-16">
                <MaterialIcon name="article" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                <p className="text-on-surface-variant text-body-md">No se encontraron artículos</p>
              </div>
            )}
          </div>
          <ListFooter
            hasMore={crud.hasMore}
            loading={crud.loadingMore}
            pageSize={10}
            loaded={crud.totalLoaded}
            total={crud.totalCount}
            onLoadMore={crud.loadMore}
          />
        </>
      )}

      {(crud.editItem || crud.showCreate) && (
        <AdminCrudModal
          open
          onClose={() => { crud.setEditItem(null); crud.setShowCreate(false); }}
          title={crud.showCreate ? "Nuevo Artículo" : "Editar Artículo"}
          size="lg"
          saving={crud.saving || crud.creating}
          saveDisabled={articleCategories.length === 0}
          onSave={handleSave}
        >
          {articleCategories.length === 0 && (
            <EnumMissingNotice
              enumCode="article_category"
              displayName="El Quisquilloso"
              itemName="un artículo de El Quisquilloso"
            />
          )}
          {articleCategories.length > 0 && (
          <div className="space-y-4">
              <FormField label="Titulo" required>
                <InputField
                  value={form.title}
                  onChange={(v: string) => setForm((f) => ({ ...f, title: v }))}
                  autoFocus
                  firstInput
                />
              </FormField>
              <FormField label="Contenido" required>
                <TextareaField
                  value={form.body}
                  onChange={(v: string) => setForm((f) => ({ ...f, body: v }))}
                  rows={8}
                />
              </FormField>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Categoria" required>
                  <SelectField
                    value={form.category}
                    onChange={(v: string) => setForm((f) => ({ ...f, category: v }))}
                    options={articleCategories.map((cat) => ({ value: cat.label, label: cat.label }))}
                    placeholder="Seleccionar..."
                  />
                </FormField>
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
                          onClick={() => setForm((f) => ({ ...f, image_url: "" }))}
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Principal</span>
                  <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-3 py-3">
                    <label className="cursor-pointer block">
                      <Switch
                        checked={form.pinned}
                        onChange={() => setForm((f) => ({ ...f, pinned: !f.pinned }))}
                      />
                    </label>
                  </div>
                </div>
                <div>
                  <span className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Destacado</span>
                  <div className="rounded-xl bg-surface-container-low border border-outline-variant/20 px-3 py-3">
                    <label className="cursor-pointer block">
                      <Switch
                        checked={form.featured}
                        onChange={() => setForm((f) => ({ ...f, featured: !f.featured }))}
                      />
                    </label>
                  </div>
                </div>
              </div>
              <p className="text-label-sm text-on-surface-variant hidden sm:block">
                Principal: solo uno a la vez, se muestra en grande en El Quisquilloso. Destacado: aparece en la pestaña &ldquo;Destacadas&rdquo;, puede haber varios.
              </p>
            </div>
          )}
        </AdminCrudModal>
      )}
    </>
  );
}
"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { api, Article, EnumValue } from "@/lib/api";
import { GlassCard, Button, Badge, SearchBar, Modal, MaterialIcon, ListFooter } from "@/components/ui";
import { useCollapsibleList } from "@/hooks/useCollapsibleList";

interface ArticlesTabProps {
  articles: Article[];
  setArticles: React.Dispatch<React.SetStateAction<Article[]>>;
  search: string;
  setSearch: (v: string) => void;
}

export function ArticlesTab({ articles, setArticles, search, setSearch }: ArticlesTabProps) {
  const [editArticle, setEditArticle] = useState<Article | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    title: "",
    body: "",
    category: "",
    image_url: "",
    featured: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [articleCategories, setArticleCategories] = useState<EnumValue[]>([]);

  useEffect(() => {
    api.getEnumCategoryByCode("article_category").then((cat) => {
      if (cat) setArticleCategories(cat.values);
    }).catch(() => {});
  }, []);

  const filtered = articles.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.category.toLowerCase().includes(search.toLowerCase()),
  );

  const { visibleItems: visibleArticles, ...articleList } = useCollapsibleList(filtered, 10);

  const openNew = () => {
    setIsNew(true);
    setEditArticle(null);
    setForm({
      title: "",
      body: "",
      category: "",
      image_url: "",
      featured: false,
    });
  };

  const openEdit = (a: Article) => {
    setIsNew(false);
    setEditArticle(a);
    setForm({
      title: a.title,
      body: a.body,
      category: a.category,
      image_url: a.image_url || "",
      featured: a.featured,
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {
        title: form.title,
        body: form.body,
        category: form.category,
        image_url: form.image_url || undefined,
        featured: form.featured,
      };
      if (isNew) {
        const created = await api.createArticle(data);
        setArticles((prev) => [...prev, created]);
      } else if (editArticle) {
        const updated = await api.updateArticle(editArticle.id, data);
        setArticles((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a)),
        );
      }
      setEditArticle(null);
      setIsNew(false);
    } catch {
      /* noop */
    }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const result = await api.uploadFile(file);
      setForm((f) => ({ ...f, image_url: result.url }));
    } catch {
      /* noop */
    }
    setUploadingImage(false);
    e.target.value = "";
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este artículo?")) return;
    try {
      await api.deleteArticle(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <SearchBar
          placeholder="Buscar artículos..."
          value={search}
          onChange={setSearch}
          size="sm"
        />
        <Button variant="primary" icon="add" onClick={openNew}>
          Nuevo Artículo
        </Button>
      </div>

      <div className={`space-y-4 ${articleList.expanded ? "max-h-[70vh] overflow-y-auto pr-1" : ""}`}>
        {visibleArticles.map((a) => (
          <GlassCard key={a.id} className="p-6" hover>
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="tag">{a.category}</Badge>
                  {a.featured && (
                    <Badge variant="rarity" color="secondary">
                      Destacado
                    </Badge>
                  )}
                </div>
                <h3 className="font-display text-title-md text-on-surface mb-1">
                  {a.title}
                </h3>
                <p className="text-label-sm text-on-surface-variant line-clamp-1">
                  {a.body.slice(0, 150)}
                  {a.body.length > 150 ? "..." : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => openEdit(a)}
                  className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                >
                  <MaterialIcon name="edit" className="text-lg" />
                </button>
                <button
                  onClick={() => handleDelete(a.id)}
                  className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                >
                  <MaterialIcon name="delete" className="text-lg" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <MaterialIcon
              name="article"
              className="text-5xl text-outline-variant mb-3 block mx-auto"
            />
            <p className="text-on-surface-variant text-body-md">
              No se encontraron artículos
            </p>
          </div>
        )}
      </div>
      <ListFooter {...articleList} onToggle={articleList.toggle} />

      {(editArticle || isNew) && (
        <Modal
          open
          onClose={() => {
            setEditArticle(null);
            setIsNew(false);
          }}
        >
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNew ? "Nuevo Artículo" : "Editar Artículo"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Titulo
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, title: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Contenido
                </label>
                <textarea
                  value={form.body}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, body: e.target.value }))
                  }
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-[160px] resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                    Categoria
                  </label>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                  >
                    <option value="">Seleccionar...</option>
                    {articleCategories.map((cat) => (
                      <option key={cat.label} value={cat.label}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                    Imagen (opcional)
                  </label>
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
                          onClick={() =>
                            setForm((f) => ({ ...f, image_url: "" }))
                          }
                        >
                          Eliminar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, featured: !f.featured }))
                  }
                  className={`relative w-12 h-7 rounded-full transition-colors ${
                    form.featured ? "bg-secondary" : "bg-outline-variant/40"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
                      form.featured ? "translate-x-5" : ""
                    }`}
                  />
                </button>
                <span className="text-body-md text-on-surface">
                  Artículo destacado
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditArticle(null);
                  setIsNew(false);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !form.title || !form.body}
                className="flex-1"
              >
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
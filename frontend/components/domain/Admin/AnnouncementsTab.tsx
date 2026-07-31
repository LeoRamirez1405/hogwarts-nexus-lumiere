"use client";

import { useState } from "react";
import { api, Announcement } from "@/lib/api";
import { GlassCard, Button, Modal, MaterialIcon, ListFooter } from "@/components/ui";
import { usePaginatedList } from "@/hooks/usePaginatedList";

export function AnnouncementsTab() {
  const [editItem, setEditItem] = useState<Announcement | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const {
    items: allAnnouncements,
    hasMore,
    loading,
    loadingMore,
    totalLoaded,
    totalCount,
    loadMore,
    refresh,
  } = usePaginatedList({
    fetcher: (p) => api.getAnnouncements(p),
    pageSize: 10,
    enabled: true,
    queryKey: ["admin-announcements"],
  });

  const visibleAnnouncements = allAnnouncements;

  const openNew = () => {
    setIsNew(true);
    setEditItem(null);
    setBody("");
  };

  const openEdit = (a: Announcement) => {
    setIsNew(false);
    setEditItem(a);
    setBody(a.body);
  };

  const handleSave = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        await api.createAnnouncement({ body: body.trim() });
        refresh();
      } else if (editItem) {
        await api.updateAnnouncement(editItem.id, {
          body: body.trim(),
        });
        refresh();
      }
      setEditItem(null);
      setIsNew(false);
    } catch {}
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este anuncio?")) return;
    try {
      await api.deleteAnnouncement(id);
      refresh();
    } catch {}
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" icon="add" onClick={openNew}>
          Nuevo Anuncio
        </Button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-16">
            <MaterialIcon
              name="progress_activity"
              className="text-4xl text-outline-variant animate-spin mb-3 block mx-auto"
            />
            <p className="text-on-surface-variant text-body-md">Cargando...</p>
          </div>
        ) : (
          <>
            {visibleAnnouncements.map((a) => (
              <GlassCard key={a.id} className="p-5" hover>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <MaterialIcon
                      name="campaign"
                      className="text-secondary text-xl shrink-0"
                      filled
                    />
                    <p className="text-body-md text-on-surface truncate">
                      {a.body}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
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
            {allAnnouncements.length === 0 && (
              <div className="text-center py-16">
                <MaterialIcon
                  name="campaign"
                  className="text-5xl text-outline-variant mb-3 block mx-auto"
                />
                <p className="text-on-surface-variant text-body-md">
                  No hay anuncios
                </p>
              </div>
            )}
          </>
        )}
      </div>
      <ListFooter
        hasMore={hasMore}
        loading={loadingMore}
        pageSize={10}
        loaded={totalLoaded}
        total={totalCount}
        onLoadMore={loadMore}
      />

      {(editItem || isNew) && (
        <Modal
          open
          onClose={() => {
            setEditItem(null);
            setIsNew(false);
          }}
        >
          <div className="p-6 space-y-5">
            <h2 className="font-display text-headline-lg text-on-surface">
              {isNew ? "Nuevo Anuncio" : "Editar Anuncio"}
            </h2>
            <div>
              <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                Texto del anuncio
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ej: La Copa de las Casas arranca el próximo viernes..."
                className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none"
              />
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => {
                  setEditItem(null);
                  setIsNew(false);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
              <Button
                variant="primary"
                onClick={handleSave}
                disabled={saving || !body.trim()}
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
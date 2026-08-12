"use client";

import { useState } from "react";
import { api, Announcement } from "@/lib/api";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField } from "@/components/ui/AdminCrudModal";
import { MentionInput } from "@/components/ui/MentionInput";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function AnnouncementsTab() {
  const crud = useAdminCrud<Announcement, { body: string }, { body: string }>({
    queryKey: ["admin-announcements"],
    fetcher: (p) => api.getAnnouncements(p),
    createFn: (data) => api.createAnnouncement(data),
    updateFn: (id, data) => api.updateAnnouncement(id, data),
    deleteFn: (id) => api.deleteAnnouncement(id),
    getDisplayName: (a) => a.body.slice(0, 50),
    getId: (a) => a.id,
    pageSize: 10,
    enabled: true,
    messages: {
      create: "Anuncio creado",
      update: "Anuncio actualizado",
      delete: "Anuncio eliminado",
    },
  });

  const [form, setForm] = useState({ body: "" });

  const handleSave = async () => {
    if (!form.body.trim()) return;
    if (crud.showCreate) {
      await crud.handleCreate({ body: form.body.trim() });
    } else if (crud.editItem) {
      await crud.handleSave(crud.editItem.id, { body: form.body.trim() });
    }
    setForm({ body: "" });
  };

  const openCreate = () => {
    setForm({ body: "" });
    crud.setShowCreate(true);
  };

  const openEdit = (a: Announcement) => {
    setForm({ body: a.body });
    crud.setEditItem(a);
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
        >
          <MaterialIcon name="add" className="text-[1.2em]" />
          Nuevo Anuncio
        </button>
      </div>

      {crud.loading ? (
        <div className="text-center py-16">
          <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3 block mx-auto" />
          <p className="text-on-surface-variant text-body-md">Cargando...</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {crud.filteredItems.map((a) => (
              <div
                key={a.id}
                className="glass-card rounded-xl p-5 hover:bg-surface-container-high transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MaterialIcon name="campaign" className="text-secondary text-xl flex-shrink-0" filled />
                  <p className="text-body-md text-on-surface truncate">{a.body}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => openEdit(a)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <MaterialIcon name="edit" className="text-lg" />
                  </button>
                  <button
                    onClick={() => crud.handleDelete(a.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                  >
                    <MaterialIcon name="delete" className="text-lg" />
                  </button>
                </div>
              </div>
            ))}
            {crud.filteredItems.length === 0 && (
              <div className="text-center py-16">
                <MaterialIcon name="campaign" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                <p className="text-on-surface-variant text-body-md">No hay anuncios</p>
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
          title={crud.showCreate ? "Nuevo Anuncio" : "Editar Anuncio"}
          size="md"
          saving={crud.saving || crud.creating}
          onSave={handleSave}
        >
          <div className="space-y-4">
            <FormField label="Texto del anuncio" required>
              <MentionInput
                value={form.body}
                onChange={(v: string) => setForm({ body: v })}
                placeholder="Ej: La Copa de las Casas arranca el próximo viernes... @menciona a alguien"
                minHeight={140}
                maxHeight={250}
              />
            </FormField>
          </div>
        </AdminCrudModal>
      )}
    </>
  );
}
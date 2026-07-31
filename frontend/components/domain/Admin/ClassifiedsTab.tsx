"use client";

import { useState } from "react";
import { api, Classified } from "@/lib/api";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { AdminCrudModal, FormField, InputField } from "@/components/ui/AdminCrudModal";
import ListFooter from "@/components/ui/ListFooter";
import Badge from "@/components/ui/Badge";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

export function ClassifiedsTab() {
  const crud = useAdminCrud<Classified, { title: string; price: string }, { title: string; price: string }>({
    queryKey: ["admin-classifieds"],
    fetcher: (p) => api.getClassifieds(p),
    createFn: (data) => api.createClassified(data),
    updateFn: (id, data) => api.updateClassified(id, data),
    deleteFn: (id) => api.deleteClassified(id),
    getDisplayName: (c) => c.title,
    getId: (c) => c.id,
    pageSize: 10,
    enabled: true,
    messages: {
      create: "Clasificado creado",
      update: "Clasificado actualizado",
      delete: "Clasificado eliminado",
    },
  });

  const [form, setForm] = useState({ title: "", price: "" });

  const handleSave = async () => {
    if (!form.title.trim() || !form.price.trim()) return;
    await crud.handleSave(crud.editItem!.id, { title: form.title.trim(), price: form.price.trim() });
    setForm({ title: "", price: "" });
  };

  const handleDelete = (id: string) => {
    confirmDialog({
      title: "Eliminar clasificado?",
      message: "Esta acción no se puede deshacer.",
      variant: "danger",
      icon: "delete",
      onConfirm: () => crud.handleDelete(id),
    });
  };

  const openCreate = () => {
    setForm({ title: "", price: "" });
    crud.setShowCreate(true);
  };

  const openEdit = (c: Classified) => {
    setForm({ title: c.title, price: c.price });
    crud.setEditItem(c);
  };

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95 whitespace-nowrap"
        >
          <MaterialIcon name="add" className="text-[1.2em]" />
          Nuevo Clasificado
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
            {crud.filteredItems.map((c) => (
              <div
                key={c.id}
                className="glass-card rounded-xl p-5 hover:bg-surface-container-high transition-colors flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <MaterialIcon name="sell" className="text-primary text-xl flex-shrink-0" />
                  <span className="text-body-md text-on-surface font-medium truncate">{c.title}</span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Badge variant="tag" color="secondary">{c.price}</Badge>
                  <button
                    onClick={() => openEdit(c)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                  >
                    <MaterialIcon name="edit" className="text-lg" />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                  >
                    <MaterialIcon name="delete" className="text-lg" />
                  </button>
                </div>
              </div>
            ))}
            {crud.filteredItems.length === 0 && (
              <div className="text-center py-16">
                <MaterialIcon name="sell" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                <p className="text-on-surface-variant text-body-md">No hay clasificados</p>
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
          title={crud.showCreate ? "Nuevo Clasificado" : "Editar Clasificado"}
          size="md"
          saving={crud.saving || crud.creating}
          onSave={handleSave}
        >
          <div className="space-y-4">
            <FormField label="Titulo" required>
              <InputField
                value={form.title}
                onChange={(v: string) => setForm((p) => ({ ...p, title: v }))}
                placeholder="Ej: Vendo escoba Nimbus 2001"
                autoFocus
                firstInput
              />
            </FormField>
            <FormField label="Precio" required>
              <InputField
                value={form.price}
                onChange={(v: string) => setForm((p) => ({ ...p, price: v }))}
                placeholder="Ej: 150 Zerines, Gratis, A convenir"
              />
            </FormField>
          </div>
        </AdminCrudModal>
      )}
    </>
  );
}
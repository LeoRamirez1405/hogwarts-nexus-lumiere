"use client";

import { useState } from "react";
import { api, Classified } from "@/lib/api";
import { GlassCard, Button, Badge, Modal, MaterialIcon } from "@/components/ui";

interface ClassifiedsTabProps {
  classifieds: Classified[];
  setClassifieds: React.Dispatch<React.SetStateAction<Classified[]>>;
}

export function ClassifiedsTab({
  classifieds,
  setClassifieds,
}: ClassifiedsTabProps) {
  const [editItem, setEditItem] = useState<Classified | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({ title: "", price: "" });
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setIsNew(true);
    setEditItem(null);
    setForm({ title: "", price: "" });
  };

  const openEdit = (c: Classified) => {
    setIsNew(false);
    setEditItem(c);
    setForm({ title: c.title, price: c.price });
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.price.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const created = await api.createClassified({
          title: form.title.trim(),
          price: form.price.trim(),
        });
        setClassifieds((prev) => [created, ...prev]);
      } else if (editItem) {
        const updated = await api.updateClassified(editItem.id, {
          title: form.title.trim(),
          price: form.price.trim(),
        });
        setClassifieds((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)),
        );
      }
      setEditItem(null);
      setIsNew(false);
    } catch {
      /* noop */
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Eliminar este clasificado?")) return;
    try {
      await api.deleteClassified(id);
      setClassifieds((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* noop */
    }
  };

  return (
    <>
      <div className="flex justify-end">
        <Button variant="primary" icon="add" onClick={openNew}>
          Nuevo Clasificado
        </Button>
      </div>

      <div className="space-y-3">
        {classifieds.map((c) => (
          <GlassCard key={c.id} className="p-5" hover>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <MaterialIcon
                  name="sell"
                  className="text-primary text-xl flex-shrink-0"
                />
                <span className="text-body-md text-on-surface font-medium truncate">
                  {c.title}
                </span>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge variant="tag" color="secondary">
                  {c.price}
                </Badge>
                <button
                  onClick={() => openEdit(c)}
                  className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
                >
                  <MaterialIcon name="edit" className="text-lg" />
                </button>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
                >
                  <MaterialIcon name="delete" className="text-lg" />
                </button>
              </div>
            </div>
          </GlassCard>
        ))}
        {classifieds.length === 0 && (
          <div className="text-center py-16">
            <MaterialIcon
              name="sell"
              className="text-5xl text-outline-variant mb-3 block mx-auto"
            />
            <p className="text-on-surface-variant text-body-md">
              No hay clasificados
            </p>
          </div>
        )}
      </div>

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
              {isNew ? "Nuevo Clasificado" : "Editar Clasificado"}
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
                  placeholder="Ej: Vendo escoba Nimbus 2001"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
                  Precio
                </label>
                <input
                  type="text"
                  value={form.price}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, price: e.target.value }))
                  }
                  placeholder="Ej: 150 Zerines, Gratis, A convenir"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
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
                disabled={saving || !form.title.trim() || !form.price.trim()}
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
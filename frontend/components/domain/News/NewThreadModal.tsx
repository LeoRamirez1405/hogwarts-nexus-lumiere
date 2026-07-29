"use client";

import { useState } from "react";
import { MaterialIcon, Button } from "@/components/ui";

interface NewThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { title: string; body: string; category: string }) => void;
}

export function NewThreadModal({ isOpen, onClose, onSubmit }: NewThreadModalProps) {
  const [newThread, setNewThread] = useState({ title: "", body: "", category: "General" });
  const [posting, setPosting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!newThread.title.trim()) return;
    setPosting(true);
    onSubmit({ ...newThread, title: newThread.title.trim(), body: newThread.body.trim() });
    setNewThread({ title: "", body: "", category: "General" });
    onClose();
    setPosting(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="font-display text-title-md text-on-surface">Iniciar Debate</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
              Titulo del debate
            </label>
            <input
              type="text"
              value={newThread.title}
              onChange={(e) =>
                setNewThread((p) => ({ ...p, title: e.target.value }))
              }
              placeholder="Ej: ¿Es el Snorkack real?"
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
              Categoria
            </label>
            <select
              value={newThread.category}
              onChange={(e) =>
                setNewThread((p) => ({ ...p, category: e.target.value }))
              }
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            >
              <option value="General">General</option>
              <option value="Zoologia Mágica">Zoologia Mágica</option>
              <option value="Economia">Economia</option>
              <option value="Ministerio">Ministerio</option>
              <option value="Hogwarts">Hogwarts</option>
              <option value="Callejones">Callejones</option>
            </select>
          </div>
          <div>
            <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
              Contenido
            </label>
            <textarea
              value={newThread.body}
              onChange={(e) =>
                setNewThread((p) => ({ ...p, body: e.target.value }))
              }
              placeholder="Argumenta tu postura..."
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none"
            />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleSubmit} disabled={posting || !newThread.title.trim()} className="flex-1">
            {posting ? "Publicando..." : "Publicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
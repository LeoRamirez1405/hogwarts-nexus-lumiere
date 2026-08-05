"use client";

import { useState, useRef, useEffect } from "react";

interface EditMessageFormProps {
  body: string;
  isOwn: boolean;
  onSave: (body: string) => void;
  onCancel: () => void;
}

export function EditMessageForm({ body, isOwn, onSave, onCancel }: EditMessageFormProps) {
  const [value, setValue] = useState(body);
  const [error, setError] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  }, []);

  const handleSave = () => {
    if (!value.trim()) {
      setError(true);
      return;
    }
    onSave(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="w-full min-w-[240px] max-w-[420px]">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (error && e.target.value.trim()) setError(false);
        }}
        onKeyDown={handleKeyDown}
        rows={Math.min(6, Math.max(2, value.split("\n").length))}
        className={`w-full resize-none rounded-lg px-3 py-2 text-body-md text-on-surface bg-surface outline-none ring-1 focus:ring-2 ${
          error
            ? "ring-error focus:ring-error"
            : "ring-outline-variant focus:ring-primary"
        }`}
        placeholder="Escribe el nuevo mensaje..."
      />
      {error && <p className="text-xs text-error mt-1">El mensaje no puede estar vacio</p>}
      <div className="flex items-center justify-end gap-2 mt-2">
        <button
          type="button"
          onClick={onCancel}
          className={`h-8 px-3 rounded-full text-label-sm text-on-surface-variant hover:bg-surface-container-high transition-colors ${isOwn ? "bg-white/10 text-white hover:bg-white/20" : ""}`}
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          className="h-8 px-4 rounded-full text-label-sm bg-primary text-on-primary hover:opacity-90 transition-opacity"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

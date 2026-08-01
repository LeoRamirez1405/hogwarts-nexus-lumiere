"use client";

import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";

export interface ValueForm {
  label: string;
  description: string;
}

interface ValueModalProps {
  open: boolean;
  isNew: boolean;
  form: ValueForm;
  onFormChange: (form: ValueForm) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function ValueModal({
  open,
  isNew,
  form,
  onFormChange,
  saving,
  onSave,
  onClose,
}: ValueModalProps) {
  if (!open) return null;

  return (
    <AdminCrudModal
      open
      onClose={onClose}
      title={isNew ? "Nuevo Valor" : "Editar Valor"}
      size="md"
      saving={saving}
      onSave={onSave}
    >
      <div className="space-y-4">
        <FormField label="Etiqueta" required>
          <InputField
            value={form.label}
            onChange={(v: string) => onFormChange({ ...form, label: v })}
            placeholder="ej: Gryffindor"
            autoFocus
            firstInput
          />
        </FormField>
        <FormField label="Descripción">
          <TextareaField
            value={form.description}
            onChange={(v: string) => onFormChange({ ...form, description: v })}
            placeholder="Descripción opcional"
          />
        </FormField>
      </div>
    </AdminCrudModal>
  );
}

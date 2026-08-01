"use client";

import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";

export interface CategoryForm {
  code: string;
  name: string;
  description: string;
}

interface CategoryModalProps {
  open: boolean;
  isCreate: boolean;
  form: CategoryForm;
  onFormChange: (form: CategoryForm) => void;
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}

export function CategoryModal({
  open,
  isCreate,
  form,
  onFormChange,
  saving,
  onSave,
  onClose,
}: CategoryModalProps) {
  if (!open) return null;

  return (
    <AdminCrudModal
      open
      onClose={onClose}
      title={isCreate ? "Nueva Categoría" : "Editar Categoría"}
      size="md"
      saving={saving}
      onSave={onSave}
    >
      <div className="space-y-4">
        <FormField label="Código" required>
          <InputField
            value={form.code}
            onChange={(v: string) => onFormChange({ ...form, code: v })}
            disabled={!isCreate}
            placeholder="ej: pet_type"
            autoFocus
            firstInput
          />
        </FormField>
        {!isCreate && <p className="text-label-sm text-on-surface-variant mt-1">El código no se puede cambiar</p>}
        <FormField label="Nombre" required>
          <InputField
            value={form.name}
            onChange={(v: string) => onFormChange({ ...form, name: v })}
            placeholder="ej: Tipo de Mascota"
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

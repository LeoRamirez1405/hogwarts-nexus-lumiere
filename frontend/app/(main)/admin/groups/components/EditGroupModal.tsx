"use client";

import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Image from "next/image";
import { AdminCrudModal, FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";

export function EditGroupModal({
  open,
  onClose,
  onSave,
  saving,
  form,
  setForm,
  avatarRef,
  onAvatarUpload,
}: {
  open: boolean;
  onClose: () => void;
  onSave: () => Promise<void>;
  saving: boolean;
  form: Partial<{
    name: string;
    description: string;
    avatar_url: string;
  }>;
  setForm: React.Dispatch<React.SetStateAction<Partial<{
    name: string;
    description: string;
    avatar_url: string;
  }>>>;
  avatarRef: React.RefObject<HTMLInputElement | null>;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  if (!open) return null;

  return (
    <AdminCrudModal
      open
      onClose={onClose}
      title="Editar Grupo"
      size="md"
      saving={saving}
      onSave={onSave}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            ref={avatarRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={onAvatarUpload}
          />
          <button
            onClick={() => avatarRef.current?.click()}
            className="relative w-20 h-20 rounded-full bg-surface-container-high flex items-center justify-center overflow-hidden border-2 border-dashed border-outline-variant/40 hover:border-primary/60 transition-colors"
          >
            {form.avatar_url ? (
              <Image
                src={form.avatar_url}
                alt="Avatar"
                fill
                className="object-cover"
                unoptimized={form.avatar_url?.startsWith("http://localhost:8000/uploads/") ?? false}
              />
            ) : (
              <MaterialIcon name="add_a_photo" className="text-2xl text-outline-variant" />
            )}
          </button>
          <div>
            <p className="text-body-md text-on-surface font-medium">Foto del grupo</p>
            <p className="text-label-sm text-on-surface-variant">Click para cambiar.</p>
          </div>
        </div>

        <FormField label="Nombre del grupo" required>
          <InputField
            value={form.name || ""}
            onChange={(v: string) => setForm((prev) => ({ ...prev, name: v }))}
          />
        </FormField>
        <FormField label="Descripcion">
          <TextareaField
            value={form.description || ""}
            onChange={(v: string) => setForm((prev) => ({ ...prev, description: v }))}
            rows={3}
          />
        </FormField>
      </div>
    </AdminCrudModal>
  );
}
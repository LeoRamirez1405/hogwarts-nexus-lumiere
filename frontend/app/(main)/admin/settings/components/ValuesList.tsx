"use client";

import { EnumValue } from "@/lib/api";
import { MaterialIcon } from "@/components/ui";

interface ValuesListProps {
  values: EnumValue[];
  onEdit: (v: EnumValue) => void;
  onDelete: (id: string) => void;
}

export function ValuesList({ values, onEdit, onDelete }: ValuesListProps) {
  return (
    <div className="space-y-2">
      {values.map((v) => (
        <div
          key={v.id}
          className="glass-card rounded-xl p-4 flex items-center gap-4 transition-all"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-body-md text-on-surface truncate">{v.label}</span>
            </div>
            {v.description && (
              <p className="text-label-sm text-on-surface-variant truncate mt-1">{v.description}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(v)}
              className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
              title="Editar"
            >
              <MaterialIcon name="edit" className="text-lg" />
            </button>
            <button
              onClick={() => onDelete(v.id)}
              className="p-2 rounded-full hover:bg-error-container text-on-surface-variant hover:text-error transition-colors"
              title="Eliminar"
            >
              <MaterialIcon name="delete" className="text-lg" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

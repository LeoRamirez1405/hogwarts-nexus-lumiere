"use client";

import { EnumCategory, EnumValue } from "@/lib/api";
import { Badge, Button, MaterialIcon } from "@/components/ui";
import { CATEGORY_ICONS, SYSTEM_CATEGORIES } from "../constants";
import { ValuesList } from "./ValuesList";

interface ValuesPanelProps {
  category: EnumCategory | null;
  onNewValue: () => void;
  onEditValue: (v: EnumValue) => void;
  onDeleteValue: (id: string) => void;
}

export function ValuesPanel({ category, onNewValue, onEditValue, onDeleteValue }: ValuesPanelProps) {
  if (!category) {
    return (
      <div className="glass-card rounded-xl flex flex-col lg:col-span-3">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <MaterialIcon name="settings" className="text-5xl text-outline-variant mb-3 block mx-auto" />
            <p className="text-on-surface-variant text-body-lg">Selecciona una categoría</p>
            <p className="text-label-sm text-on-surface-variant mt-1">para gestionar sus valores</p>
          </div>
        </div>
      </div>
    );
  }

  const isSystem = SYSTEM_CATEGORIES.includes(category.code);

  return (
    <div className="glass-card rounded-xl flex flex-col lg:col-span-3">
      <div className="p-4 border-b border-outline-variant/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <MaterialIcon name={CATEGORY_ICONS[category.code] || "category"} className="text-2xl text-primary" filled />
          <div>
            <h2 className="font-display text-headline-lg text-on-surface">{category.name}</h2>
            <p className="text-label-sm text-on-surface-variant">{category.description}</p>
          </div>
          {isSystem && <Badge variant="tag" color="default">Sistema</Badge>}
        </div>
        <Button variant="primary" icon="add" onClick={onNewValue}>
          Nuevo Valor
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {category.values.length === 0 ? (
          <div className="text-center py-16">
            <MaterialIcon name="category" className="text-4xl text-outline-variant mb-3 block mx-auto" />
            <p className="text-on-surface-variant text-body-md">No hay valores en esta categoría</p>
            <p className="text-label-sm text-on-surface-variant mt-1">Haz clic en Nuevo Valor para agregar uno</p>
          </div>
        ) : (
          <ValuesList
            key={category.id}
            values={category.values}
            onEdit={onEditValue}
            onDelete={onDeleteValue}
          />
        )}
      </div>
    </div>
  );
}

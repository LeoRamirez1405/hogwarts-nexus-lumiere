"use client";

import Link from "next/link";
import { MaterialIcon } from "@/components/ui/MaterialIcon";

interface EnumMissingNoticeProps {
  enumCode: string;
  displayName: string;
  itemName: string;
}

/**
 * Bloqueo mostrado dentro de un formulario de creación cuando el enum
 * requerido (categorías) no tiene valores configurados. Guía al admin a
 * /admin/settings para crear las categorías primero.
 */
export function EnumMissingNotice({ enumCode, displayName, itemName }: EnumMissingNoticeProps) {
  return (
    <div className="text-center py-10 px-4">
      <MaterialIcon name="warning" className="text-5xl text-secondary mb-3 block mx-auto" />
      <h3 className="font-display text-title-lg text-on-surface mb-2">
        No hay categorías configuradas
      </h3>
      <p className="text-body-md text-on-surface-variant mb-4">
        Para crear {itemName} necesitas al menos una categoría de{" "}
        <strong className="text-on-surface">{displayName}</strong>, pero todavía no existe ninguna.
      </p>
      <p className="text-label-sm text-on-surface-variant/70 mb-6">
        Ve a <strong>Administración → Configuración</strong> y crea primero las categorías con
        código{" "}
        <code className="font-mono bg-surface-container-high px-1.5 py-0.5 rounded text-primary">
          {enumCode}
        </code>
        .
      </p>
      <Link
        href="/admin/settings"
        className="inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-medium text-label-sm hover:opacity-90 transition-all active:scale-95"
      >
        <MaterialIcon name="settings" className="text-[1.2em]" />
        Ir a Configuración
      </Link>
    </div>
  );
}

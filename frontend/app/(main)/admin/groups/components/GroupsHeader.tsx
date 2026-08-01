"use client";

import Button from "@/components/ui/Button";

export function GroupsHeader({ onCreateClick }: {
  onCreateClick: () => void;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <h1 className="font-display text-headline-lg text-on-surface">Gestion de Grupos</h1>
        <p className="text-on-surface-variant text-body-md mt-1">
          Crea y administra grupos de chat. Solo administradores.
        </p>
      </div>
      <Button variant="primary" icon="add" iconPosition="left" onClick={onCreateClick}>
        Nuevo Grupo
      </Button>
    </div>
  );
}
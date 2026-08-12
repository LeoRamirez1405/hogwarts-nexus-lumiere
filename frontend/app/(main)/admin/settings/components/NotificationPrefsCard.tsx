"use client";

import { useState } from "react";
import { MaterialIcon, Switch } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface NotificationPrefsCardProps {
  enabled: boolean;
  updating: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
}

export function NotificationPrefsCard({ enabled, updating, onToggle }: NotificationPrefsCardProps) {
  const [pending, setPending] = useState(false);
  const busy = updating || pending;

  const handleToggle = async (next: boolean) => {
    setPending(true);
    try {
      await onToggle(next);
      toastSuccess(
        next ? "Notificaciones activadas" : "Notificaciones desactivadas",
        next
          ? "Recibirás avisos de cada compra en el marketplace."
          : "Dejarás de recibir avisos de compras en el marketplace."
      );
    } catch (e) {
      toastError("No se pudo actualizar la preferencia", e);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <MaterialIcon name="notifications_active" className="text-xl text-on-secondary" />
        </div>
        <div>
          <h2 className="font-display text-title-md text-on-surface">Notificaciones de Compras</h2>
          <p className="text-label-sm text-on-surface-variant">
            Recibe un aviso cuando un usuario compre en Borgin &amp; Burkes o Flourish &amp; Blotts.
          </p>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
            <MaterialIcon
              name={enabled ? "notifications" : "notifications_off"}
              className="text-lg text-on-surface-variant"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-body-md text-on-surface">Alertas de compras del marketplace</p>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {enabled
                ? "Activado — te notificaremos cuando se realice una compra."
                : "Desactivado — las compras no generarán notificaciones para ti."}
            </p>
          </div>
        </div>
        <div className="sm:shrink-0">
          <Switch
            checked={enabled}
            onChange={handleToggle}
            disabled={busy}
            label={enabled ? "Activado" : "Desactivado"}
          />
        </div>
      </div>
    </div>
  );
}

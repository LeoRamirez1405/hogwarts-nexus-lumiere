"use client";

import { FeatureFlag } from "@/lib/api";
import { Badge, MaterialIcon, Switch } from "@/components/ui";
import { CATEGORY_LABELS } from "../constants";

interface FeatureFlagsCardProps {
  flags: FeatureFlag[];
  loading: boolean;
  updatingKey: string | null;
  onToggle: (flag: FeatureFlag) => void;
}

export function FeatureFlagsCard({ flags, loading, updatingKey, onToggle }: FeatureFlagsCardProps) {
  return (
    <div className="glass-card rounded-xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-tertiary flex items-center justify-center">
          <MaterialIcon name="toggle_on" className="text-xl text-on-tertiary" />
        </div>
        <div>
          <h2 className="font-display text-title-md text-on-surface">Visibilidad de Secciones</h2>
          <p className="text-label-sm text-on-surface-variant">
            Activa o desactiva secciones específicas de la plataforma. Los cambios se reflejan inmediatamente para todos los usuarios.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-outline-variant/20 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : flags.length === 0 ? (
        <div className="text-center py-8">
          <MaterialIcon name="toggle_off" className="text-4xl text-outline-variant mb-2 block mx-auto" />
          <p className="text-on-surface-variant text-body-md">No hay feature flags configurados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((flag) => {
            const meta = flag.category ? CATEGORY_LABELS[flag.category] : null;
            return (
              <div
                key={flag.key}
                className="flex items-center justify-between gap-4 p-4 rounded-xl bg-surface-container-low border border-outline-variant/20"
              >
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-surface-container-high flex items-center justify-center shrink-0">
                    <MaterialIcon
                      name={meta?.icon || "toggle_on"}
                      className="text-lg text-on-surface-variant"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-body-md text-on-surface">{flag.name}</p>
                      {meta && (
                        <Badge variant="tag" color="default">{meta.label}</Badge>
                      )}
                      {flag.enabled && (
                        <Badge variant="tag" color="primary">Activo</Badge>
                      )}
                    </div>
                    {flag.description && (
                      <p className="text-label-sm text-on-surface-variant mt-1">{flag.description}</p>
                    )}
                  </div>
                </div>
                <Switch
                  checked={flag.enabled}
                  onChange={() => onToggle(flag)}
                  disabled={updatingKey === flag.key}
                  label={flag.name}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { api, RouletteConfig, RouletteSegment } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { AdminCrudModal, FormField, InputField } from "@/components/ui/AdminCrudModal";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import { MaterialIcon } from "@/components/ui";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface SegmentDraft {
  prize: string;
  label: string;
  weight: string;
  pack_type_id: string;
}

function draftToSegment(d: SegmentDraft): RouletteSegment {
  return {
    prize: d.prize,
    label: d.label.trim() || d.prize,
    weight: Math.max(1, parseInt(d.weight) || 0),
    pack_type_id: d.prize.startsWith("pack:") && d.pack_type_id ? d.pack_type_id : undefined,
  };
}

export default function AdminRoulettePage() {
  const { user } = useAuthStore();
  const [config, setConfig] = useState<RouletteConfig | null>(null);
  const [cost, setCost] = useState("100");
  const [enabled, setEnabled] = useState(true);
  const [segments, setSegments] = useState<SegmentDraft[]>([]);
  const [packTypes, setPackTypes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cfg, store] = await Promise.all([api.getConfig(), api.getStore()]);
        if (cancelled) return;
        setConfig(cfg);
        setCost(String(cfg.cost_zerines));
        setEnabled(cfg.enabled);
        setSegments(
          cfg.segments.map((s) => ({
            prize: s.prize,
            label: s.label,
            weight: String(s.weight),
            pack_type_id: s.pack_type_id ?? "",
          }))
        );
        setPackTypes(store.pack_types.map((p) => ({ id: p.id, name: p.name })));
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar la configuración de la ruleta", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user?.role !== "admin") return null;

  const valid = parseInt(cost) > 0 && segments.length > 0 && segments.every((s) => parseInt(s.weight) > 0);

  const addSegment = () => {
    setSegments((s) => [
      ...s,
      { prize: "pack:1", label: "1 Sobre", weight: "10", pack_type_id: "" },
    ]);
  };

  const updateSegment = (index: number, patch: Partial<SegmentDraft>) => {
    setSegments((s) => s.map((seg, i) => (i === index ? { ...seg, ...patch } : seg)));
  };

  const removeSegment = (index: number) => {
    setSegments((s) => s.filter((_, i) => i !== index));
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await api.updateRouletteConfig({
        cost_zerines: parseInt(cost) || 0,
        segments: segments.map(draftToSegment),
        enabled,
      });
      toastSuccess("Ruleta actualizada", "La configuración se guardó");
      setShowEditor(false);
      const cfg = await api.getConfig();
      setConfig(cfg);
      setCost(String(cfg.cost_zerines));
      setEnabled(cfg.enabled);
      setSegments(
        cfg.segments.map((s) => ({
          prize: s.prize,
          label: s.label,
          weight: String(s.weight),
          pack_type_id: s.pack_type_id ?? "",
        }))
      );
    } catch (e) {
      toastError("No se pudo guardar la ruleta", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">Ruleta de la Fortuna Mágica</h1>
          <p className="text-xs text-outline">Costo por giro y segmentos ponderados.</p>
        </div>
        <Button onClick={() => setShowEditor(true)} icon="tune" disabled={loading}>
          Editar configuración
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-outline">Cargando…</p>
      ) : (
        <GlassCard className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-semibold text-primary">
              Costo: <ZerineDisplay amount={config?.cost_zerines ?? 0} variant="price" />
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${
                config?.enabled ? "bg-emerald-600/15 text-emerald-700" : "bg-outline/15 text-outline"
              }`}
            >
              {config?.enabled ? "Activa" : "Desactivada"}
            </span>
          </div>
          <p className="mb-2 text-xs uppercase tracking-widest text-outline">Segmentos</p>
          <ul className="space-y-2">
            {(config?.segments ?? []).map((seg, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-secondary" />
                <span className="font-medium text-primary">{seg.label}</span>
                <span className="font-mono text-[11px] text-outline">{seg.prize}</span>
                <span className="ml-auto font-mono text-xs text-outline">{seg.weight} pts</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      )}

      <AdminCrudModal
        open={showEditor}
        onClose={() => setShowEditor(false)}
        title="Configurar ruleta"
        saving={saving}
        saveDisabled={!valid}
        saveLabel="Guardar ruleta"
        onSave={save}
      >
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Costo" required>
            <InputField type="number" value={cost} onChange={setCost} firstInput />
          </FormField>
          <FormField label="Estado">
            <select
              value={enabled ? "1" : "0"}
              onChange={(e) => setEnabled(e.target.value === "1")}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md"
            >
              <option value="1">Activa</option>
              <option value="0">Desactivada</option>
            </select>
          </FormField>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-primary">Segmentos</p>
            <Button variant="secondary" size="sm" icon="add" onClick={addSegment}>
              Añadir
            </Button>
          </div>
          {segments.map((seg, i) => (
            <div key={i} className="space-y-2 rounded-xl border border-outline/15 bg-surface-container-low p-3">
              <div className="flex items-center gap-2">
                <select
                  value={seg.prize.startsWith("pack:") ? "pack" : seg.prize}
                  onChange={(e) => {
                    const kind = e.target.value;
                    updateSegment(i, {
                      prize: kind === "pack" ? "pack:1" : kind === "zerines" ? "zerines:100" : "legendary",
                      label:
                        kind === "pack" ? "1 Sobre" : kind === "zerines" ? "100 Zerines" : "¡Legendaria garantizada!",
                      pack_type_id: "",
                    });
                  }}
                  className="flex-1 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                >
                  <option value="pack">Sobre(s)</option>
                  <option value="zerines">Zerines</option>
                  <option value="legendary">Legendaria garantizada</option>
                </select>
                <InputField
                  type="number"
                  value={seg.weight}
                  onChange={(v) => updateSegment(i, { weight: v })}
                  placeholder="Peso"
                  className="!w-20 !px-2 !py-1.5 !text-sm"
                />
                <Button variant="ghost" size="sm" icon="delete" onClick={() => removeSegment(i)}>
                  Quitar
                </Button>
              </div>
              {seg.prize.startsWith("pack:") ? (
                <div className="flex items-center gap-2">
                  <InputField
                    type="number"
                    value={seg.prize.split(":")[1] ?? "1"}
                    onChange={(v) => updateSegment(i, { prize: `pack:${parseInt(v) || 1}` })}
                    className="!w-20 !px-2 !py-1.5 !text-sm"
                  />
                  <span className="text-xs text-outline">sobres</span>
                  <select
                    value={seg.pack_type_id}
                    onChange={(e) => updateSegment(i, { pack_type_id: e.target.value })}
                    className="flex-1 rounded-lg border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-sm"
                  >
                    <option value="">Auto (sobre más barato)</option>
                    {packTypes.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : seg.prize.startsWith("zerines:") ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-outline">Cantidad:</span>
                  <InputField
                    type="number"
                    value={seg.prize.split(":")[1] ?? "100"}
                    onChange={(v) => updateSegment(i, { prize: `zerines:${parseInt(v) || 0}` })}
                    className="!w-24 !px-2 !py-1.5 !text-sm"
                  />
                  <ZerineDisplay amount={1} variant="price" size="sm" />
                </div>
              ) : null}
              <InputField
                value={seg.label}
                onChange={(v) => updateSegment(i, { label: v })}
                placeholder="Etiqueta visible (ej: 1 Sobre de Lechuza)"
                className="!px-2 !py-1.5 !text-sm"
              />
            </div>
          ))}
          {segments.length === 0 && (
            <p className="flex items-center gap-2 text-sm text-outline">
              <MaterialIcon name="info" className="text-base" /> Sin segmentos la ruleta no puede girar.
            </p>
          )}
        </div>
      </AdminCrudModal>
    </div>
  );
}
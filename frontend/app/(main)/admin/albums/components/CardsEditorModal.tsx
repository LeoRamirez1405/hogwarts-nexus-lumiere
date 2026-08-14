"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { api, Album, AlbumCard, AlbumCardInput } from "@/lib/api";
import { AdminCrudModal, InputField, SelectField } from "@/components/ui/AdminCrudModal";
import Button from "@/components/ui/Button";
import { MaterialIcon } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

const RARITY_OPTIONS = [
  { value: "common", label: "Común" },
  { value: "rare", label: "Rara" },
  { value: "ultra_rare", label: "Ultra Rara" },
  { value: "special", label: "Especial" },
  { value: "legendary", label: "Legendaria" },
];

const DEFAULT_RARITY = [
  ...Array.from({ length: 14 }, () => "common"),
  ...Array.from({ length: 5 }, () => "rare"),
  ...Array.from({ length: 3 }, () => "ultra_rare"),
  ...Array.from({ length: 2 }, () => "special"),
  "legendary",
];

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface CardDraft {
  slot_number: number;
  title: string;
  image_url: string;
  rarity: string;
}

interface CardsEditorModalProps {
  album: Album;
  onClose: () => void;
  onSaved: () => void;
}

export function CardsEditorModal({ album, onClose, onSaved }: CardsEditorModalProps) {
  const [drafts, setDrafts] = useState<CardDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [uploadSlot, setUploadSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shuffledRarities = useMemo(() => shuffle(DEFAULT_RARITY), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const detail = await api.getAlbum(album.id);
        if (cancelled) return;
        const bySlot = new Map(detail.cards.map((c) => [c.slot_number, c]));
        setDrafts(
          Array.from({ length: 25 }, (_, i) => {
            const slot = i + 1;
            const existing = bySlot.get(slot);
            return {
              slot_number: slot,
              title: existing?.title ?? "",
              image_url: existing?.image_url ?? "",
              rarity: existing?.rarity ?? shuffledRarities[i] ?? "common",
            };
          })
        );
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudieron cargar las cartas", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [album.id, shuffledRarities]);

  const updateDraft = (slot: number, patch: Partial<CardDraft>) => {
    setDrafts((d) => d.map((card) => (card.slot_number === slot ? { ...card, ...patch } : card)));
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, slot: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot(slot);
    try {
      const result = await api.uploadFile(file);
      updateDraft(slot, { image_url: result.url });
      toastSuccess(`Figurita #${slot} subida`);
    } catch (err) {
      toastError(`No se pudo subir la figurita #${slot}`, err);
    }
    setUploadingSlot(null);
    e.target.value = "";
  };

  const saveAll = async () => {
    if (drafts.some((d) => !d.image_url)) {
      toastError("Todas las cartas necesitan imagen", undefined);
      return;
    }
    setSaving(true);
    try {
      const payload: AlbumCardInput[] = drafts.map((d) => ({
        slot_number: d.slot_number,
        title: d.title.trim() || undefined,
        image_url: d.image_url,
        rarity: d.rarity as AlbumCard["rarity"],
      }));
      await api.upsertAlbumCards(album.id, payload);
      toastSuccess("Cartas guardadas", "Las 25 figuritas se actualizaron");
      onSaved();
      onClose();
    } catch (e) {
      toastError("No se pudieron guardar las cartas", e);
    } finally {
      setSaving(false);
    }
  };

  const filled = drafts.filter((d) => d.image_url).length;

  return (
    <AdminCrudModal
      open
      onClose={onClose}
      title={`Cartas — ${album.name}`}
      size="lg"
      saving={saving}
      saveLabel="Guardar cartas"
      saveDisabled={loading || saving || drafts.some((d) => !d.image_url)}
      onSave={saveAll}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-outline">
          {filled}/25 cartas.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {drafts.map((draft) => (
          <div
            key={draft.slot_number}
            className="flex items-center gap-3 rounded-xl border border-outline/15 bg-surface-container-low p-3"
          >
            <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-container-high">
              {draft.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={draft.image_url} alt={`#${draft.slot_number}`} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center text-outline">
                  <MaterialIcon name="help" className="text-base" />
                  <span className="text-[9px] font-mono">{draft.slot_number}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-7 shrink-0 text-[11px] font-mono text-outline">
                  #{draft.slot_number}
                </span>
                <SelectField
                  value={draft.rarity}
                  onChange={(v) => updateDraft(draft.slot_number, { rarity: v })}
                  options={RARITY_OPTIONS}
                  className="!px-2 !py-1 !text-xs"
                />
              </div>
              <InputField
                value={draft.title}
                onChange={(v) => updateDraft(draft.slot_number, { title: v })}
                placeholder="Título (opcional)"
                className="!px-2 !py-1 !text-xs"
              />
              <div className="flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon="upload"
                  disabled={uploadingSlot !== null}
                  onClick={() => {
                    setUploadSlot(draft.slot_number);
                    fileInputRef.current?.click();
                  }}
                >
                  {uploadingSlot === draft.slot_number ? "..." : "Subir"}
                </Button>
                {draft.image_url && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="delete"
                    onClick={() => updateDraft(draft.slot_number, { image_url: "" })}
                  >
                    Quitar
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const slot = uploadSlot;
          setUploadSlot(null);
          if (slot) handleUpload(e, slot);
        }}
      />
      <p className="text-[11px] text-outline">
        Las imágenes se comprimen a WebP al subir. Guarda siempre las 25 para publicar la edición.
      </p>
    </AdminCrudModal>
  );
}
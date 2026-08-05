"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui";
import Avatar from "@/components/ui/Avatar";
import { eventsApi } from "@/lib/api/eventsApi";
import type { RSVPListItem, RSVPStatus } from "@/lib/api/events";
import { RSVP_LABELS } from "@/lib/api/events";

interface EventCensusModalProps {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onClose: () => void;
}

const GROUPS: { status: RSVPStatus; tint: string }[] = [
  { status: "going", tint: "text-emerald-600" },
  { status: "maybe", tint: "text-amber-600" },
  { status: "not_going", tint: "text-red-600" },
];

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function EventCensusModal({ eventId, eventTitle, open, onClose }: EventCensusModalProps) {
  const [items, setItems] = useState<RSVPListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await eventsApi.listRsvps(eventId);
        if (!cancelled) setItems(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error al cargar asistentes");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, eventId]);

  if (!open) return null;

  const byStatus = (s: RSVPStatus) => items.filter((i) => i.status === s);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-surface-container-low rounded-t-3xl sm:rounded-3xl border border-outline-variant/20 shadow-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 py-4 flex items-center justify-between border-b border-outline-variant/10">
          <div className="min-w-0">
            <h3 className="font-display text-headline-sm text-on-surface truncate">Asistentes</h3>
            <p className="text-label-sm text-on-surface-variant truncate">{eventTitle}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high shrink-0"
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" className="text-on-surface-variant" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <p className="text-center text-body-md text-on-surface-variant py-8">Cargando…</p>
          ) : error ? (
            <p className="text-center text-body-md text-error py-8">{error}</p>
          ) : items.length === 0 ? (
            <p className="text-center text-body-md text-on-surface-variant py-8">
              Nadie ha respondido todavía
            </p>
          ) : (
            GROUPS.map(({ status, tint }) => {
              const list = byStatus(status);
              const meta = RSVP_LABELS[status];
              return (
                <div key={status}>
                  <div className="flex items-center gap-2 mb-2">
                    <MaterialIcon name={meta.icon} className={`text-[1.1em] ${tint}`} />
                    <span className="text-label-md font-semibold text-on-surface">{meta.label}</span>
                    <span className="text-label-sm text-on-surface-variant">· {list.length}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-label-sm text-on-surface-variant pl-7">—</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {list.map((p) => (
                        <li key={p.user_id} className="flex items-center gap-3 pl-1">
                          <Avatar src={p.avatar_url ?? undefined} size="xs" initials={initialsOf(p.name)} />
                          <div className="min-w-0">
                            <p className="text-body-md text-on-surface truncate">{p.name}</p>
                            {p.house && (
                              <p className="text-label-sm text-on-surface-variant truncate">{p.house}</p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

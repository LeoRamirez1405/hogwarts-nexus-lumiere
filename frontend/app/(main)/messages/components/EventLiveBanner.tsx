"use client";

import { useState, useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AdminCrudModal, FormField, SelectField } from "@/components/ui/AdminCrudModal";
import type { Event, RSVPStatus, ReminderTime } from "@/lib/api/events";
import { RSVP_LABELS, REMINDER_LABELS } from "@/lib/api/events";

interface EventLiveBannerProps {
  event: Event;
  isAdminOrMod: boolean;
  onRsvp: (eventId: string, status: RSVPStatus) => Promise<void>;
  onRemoveRsvp: (eventId: string) => Promise<void>;
  onSetReminder: (eventId: string, reminder: ReminderTime) => Promise<void>;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => Promise<void>;
  onOpenCensus: () => void;
  onJoinVoice?: (channelId: string) => void;
}

const RSVP_OPTIONS: { value: RSVPStatus; label: string; icon: string }[] = [
  { value: "going", label: RSVP_LABELS.going.label, icon: RSVP_LABELS.going.icon },
  { value: "maybe", label: RSVP_LABELS.maybe.label, icon: RSVP_LABELS.maybe.icon },
  { value: "not_going", label: RSVP_LABELS.not_going.label, icon: RSVP_LABELS.not_going.icon },
];

const REMINDER_OPTIONS: { value: ReminderTime; label: string }[] = [
  { value: "at_time", label: REMINDER_LABELS.at_time },
  { value: "15min", label: REMINDER_LABELS["15min"] },
  { value: "1h", label: REMINDER_LABELS["1h"] },
  { value: "3h", label: REMINDER_LABELS["3h"] },
  { value: "1d", label: REMINDER_LABELS["1d"] },
  { value: "3d", label: REMINDER_LABELS["3d"] },
  { value: "1w", label: REMINDER_LABELS["1w"] },
];

/**
 * Minimalist banner shown above the chat for the room's single live event.
 *
 * Two visual states:
 *   - En curso → primary (blue) + pulsing dot
 *   - Próximo  → secondary (gold) + a clock-decorator (no pulse)
 *
 * Inline content:
 *   - Title + status + (when upcoming) the start time
 *   - RSVP buttons (Voy / Quizás / No voy) — toggles off when re-clicked
 *   - Attendee count button → census modal
 *   - Voice channel join (if applicable)
 *   - "···" menu: set reminder, edit or delete (admin/mod only)
 */
export default function EventLiveBanner({
  event,
  isAdminOrMod,
  onRsvp,
  onRemoveRsvp,
  onSetReminder,
  onEdit,
  onDelete,
  onOpenCensus,
  onJoinVoice,
}: EventLiveBannerProps) {
  const inProgress = event.in_progress;
  const goingCount = event.rsvp_counts?.going || 0;
  const maybeCount = event.rsvp_counts?.maybe || 0;
  const attendees = goingCount + maybeCount;

  const [showRsvpMenu, setShowRsvpMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reminderPick, setReminderPick] = useState<ReminderTime>(event.reminder_time ?? "1h");
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close "..." menu on outside click.
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const handleRsvpClick = async (status: RSVPStatus) => {
    setShowRsvpMenu(false);
    if (event.my_rsvp === status) {
      await onRemoveRsvp(event.id);
    } else {
      await onRsvp(event.id, status);
    }
  };

  const rsvpActiveClass = (status: RSVPStatus) =>
    event.my_rsvp === status
      ? "bg-on-primary/25 font-semibold"
      : "bg-on-primary/10 hover:bg-on-primary/20";

  // Container color scheme depends on state.
  const containerClass = inProgress
    ? "bg-primary/90 text-on-primary border-primary/30"
    : "bg-secondary/90 text-on-secondary border-secondary/30";

  return (
    <>
      <div
        className={`w-full flex items-center gap-2 px-3 py-2 backdrop-blur-sm border-b ${containerClass}`}
      >
        {/* Pulse (in progress) or static dot (upcoming) */}
        <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
          {inProgress && (
            <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-60 animate-ping" />
          )}
          <span
            className={`relative inline-flex h-2.5 w-2.5 rounded-full ${inProgress ? "bg-current" : "border-2 border-current"}`}
          />
        </span>

        {/* Title / status / time */}
        <div className="flex-1 min-w-0">
          <p className="text-label-sm font-semibold truncate">
            {inProgress ? "En curso · " : "Próximo · "}
            {event.title}
          </p>
          {!inProgress && event.starts_at && (
            <p className="text-label-xs opacity-80 truncate">
              {format(new Date(event.starts_at), "EEE d MMM 'a' HH:mm", { locale: es })}
            </p>
          )}
        </div>

        {/* Voice channel join */}
        {event.voice_channel_id && onJoinVoice && (
          <button
            onClick={() => onJoinVoice(event.voice_channel_id!)}
            className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-on-primary/15 hover:bg-on-primary/25 transition-colors"
            title="Unirse al canal de voz"
          >
            <MaterialIcon name="mic" className="text-[1.05em]" />
          </button>
        )}

        {/* Census button */}
        <button
          onClick={onOpenCensus}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-on-primary/15 hover:bg-on-primary/25 transition-colors shrink-0"
          title="Ver asistentes"
        >
          <MaterialIcon name="groups" className="text-[1.05em]" />
          <span className="text-label-sm font-medium">{attendees}</span>
        </button>

        {/* RSVP menu trigger */}
        <div className="relative shrink-0">
          <button
            onClick={() => setShowRsvpMenu(!showRsvpMenu)}
            className="flex items-center gap-1 px-2 py-1 rounded-full transition-colors"
            title="Tu respuesta"
          >
            {event.my_rsvp ? (
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm ${rsvpActiveClass(event.my_rsvp)}`}>
                <MaterialIcon name={RSVP_LABELS[event.my_rsvp].icon} className="text-[1em]" />
                <span className="hidden sm:inline">{RSVP_LABELS[event.my_rsvp].label}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm bg-on-primary/10 hover:bg-on-primary/20 transition-colors">
                <MaterialIcon name="how_to_reg" className="text-[1em]" />
                <span className="hidden sm:inline">Responder</span>
              </span>
            )}
          </button>
          {showRsvpMenu && (
            <>
              <div className="fixed inset-0 z-[60]" onClick={() => setShowRsvpMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-[61] bg-surface-container-low rounded-xl border border-outline-variant/30 shadow-xl p-1 min-w-[160px]">
                {RSVP_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRsvpClick(opt.value)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-md font-medium transition-colors hover:bg-surface-container-high ${
                      event.my_rsvp === opt.value ? "text-primary bg-primary/10" : "text-on-surface"
                    }`}
                  >
                    <MaterialIcon name={opt.icon} className="text-lg" />
                    {opt.label}
                    {event.my_rsvp === opt.value && (
                      <MaterialIcon name="check" className="text-lg ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* "..." menu */}
        <div className="relative shrink-0" ref={moreMenuRef}>
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-on-primary/10 hover:bg-on-primary/20 transition-colors"
            title="Más opciones"
          >
            <MaterialIcon name="more_horiz" className="text-lg" />
          </button>
          {showMoreMenu && (
            <div className="absolute right-0 top-full mt-1 z-[60] bg-surface-container-low rounded-xl border border-outline-variant/30 shadow-xl p-1 min-w-[200px] text-on-surface">
              <button
                onClick={() => {
                  setShowMoreMenu(false);
                  setShowReminderModal(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-md font-medium hover:bg-surface-container-high transition-colors"
              >
                <MaterialIcon name="notifications" className="text-lg" />
                Recordatorio: {REMINDER_LABELS[event.reminder_time ?? "1h"]}
              </button>
              {isAdminOrMod && (
                <>
                  <div className="border-t border-outline-variant/20 my-1" />
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      onEdit(event);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-md font-medium hover:bg-surface-container-high transition-colors"
                  >
                    <MaterialIcon name="edit" className="text-lg" />
                    Editar
                  </button>
                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-md font-medium text-on-error-container hover:bg-error-container/30 transition-colors"
                  >
                    <MaterialIcon name="delete" className="text-lg" />
                    Eliminar
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reminder modal — picked from the "..." menu */}
      {showReminderModal && (
        <AdminCrudModal
          open={true}
          onClose={() => setShowReminderModal(false)}
          title="Recordatorio"
          saving={false}
          onSave={async () => {
            await onSetReminder(event.id, reminderPick);
            setShowReminderModal(false);
          }}
        >
          <FormField label="Cuándo avisarte">
            <SelectField
              value={reminderPick}
              onChange={(v) => setReminderPick(v as ReminderTime)}
              options={REMINDER_OPTIONS}
              placeholder="Seleccionar..."
              className="min-w-[180px]"
            />
          </FormField>
        </AdminCrudModal>
      )}

      {/* Delete confirm — admin/mod only */}
      {showDeleteConfirm && (
        <AdminCrudModal
          open={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="Eliminar evento"
          saving={false}
          saveLabel="Eliminar"
          onSave={async () => {
            await onDelete(event.id);
            setShowDeleteConfirm(false);
          }}
        >
          <FormField label="¿Estás seguro de que quieres eliminar este evento?">
            <p className="text-body-md text-on-surface-variant">
              Esta acción no se puede deshacer. Los asistentes serán notificados.
            </p>
          </FormField>
        </AdminCrudModal>
      )}
    </>
  );
}

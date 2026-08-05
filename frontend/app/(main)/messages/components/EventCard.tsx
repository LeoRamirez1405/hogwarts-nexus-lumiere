"use client";

import { useState } from "react";
import { MaterialIcon } from "@/components/ui";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AdminCrudModal, FormField, SelectField } from "@/components/ui/AdminCrudModal";
import Button from "@/components/ui/Button";
import type { Event, RSVPStatus, ReminderTime } from "@/lib/api/events";
import { RSVP_LABELS, REMINDER_LABELS, LOCATION_LABELS } from "@/lib/api/events";
import EventCensusModal from "./EventCensusModal";

interface EventCardProps {
  event: Event;
  currentUserId: string;
  isAdminOrMod: boolean;
  onRsvp: (eventId: string, status: RSVPStatus) => Promise<void>;
  onRemoveRsvp: (eventId: string) => Promise<void>;
  onSetReminder: (eventId: string, reminder: ReminderTime) => Promise<void>;
  onEdit: (event: Event) => void;
  onDelete: (eventId: string) => Promise<void>;
  onJoinVoice?: (channelId: string) => void;
}

export default function EventCard({
  event,
  currentUserId,
  isAdminOrMod,
  onRsvp,
  onRemoveRsvp,
  onSetReminder,
  onEdit,
  onDelete,
  onJoinVoice,
}: EventCardProps) {
  const [showRsvpMenu, setShowRsvpMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCensus, setShowCensus] = useState(false);

  const isPast = new Date(event.starts_at) < new Date();
  const isCancelled = event.status === "cancelled";
  const isCreator = event.created_by === currentUserId;
  const canEdit = isAdminOrMod || isCreator;
  const goingCount = event.rsvp_counts?.going || 0;
  const maybeCount = event.rsvp_counts?.maybe || 0;
  const totalAttendees = goingCount + maybeCount;

  const rsvpOptions = [
    { value: "going", label: RSVP_LABELS.going.label, color: "primary" as const },
    { value: "maybe", label: RSVP_LABELS.maybe.label, color: "secondary" as const },
    { value: "not_going", label: RSVP_LABELS.not_going.label, color: "primary" as const },
  ] as const;

  const handleRsvp = async (status: RSVPStatus) => {
    setShowRsvpMenu(false);
    if (event.my_rsvp === status) {
      await onRemoveRsvp(event.id);
    } else {
      await onRsvp(event.id, status);
    }
  };

  const reminderOptions: { value: ReminderTime; label: string }[] = [
    { value: "at_time", label: REMINDER_LABELS.at_time },
    { value: "15min", label: REMINDER_LABELS["15min"] },
    { value: "1h", label: REMINDER_LABELS["1h"] },
    { value: "3h", label: REMINDER_LABELS["3h"] },
    { value: "1d", label: REMINDER_LABELS["1d"] },
    { value: "3d", label: REMINDER_LABELS["3d"] },
    { value: "1w", label: REMINDER_LABELS["1w"] },
  ];

  const locationInfo = LOCATION_LABELS[event.location_type];

  return (
    <div className={`bg-surface-container-low rounded-2xl border border-outline-variant/20 overflow-hidden ${isCancelled ? "opacity-50" : ""}`}>
      {/* Header with status */}
      <div className={`px-4 py-3 flex items-start justify-between gap-2 ${isCancelled ? "bg-error-container/30" : "bg-surface-container-low/50"} border-b border-outline-variant/10`}>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-headline-sm text-on-surface truncate pr-2">
            {event.title}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-label-sm text-on-surface-variant">
            <span className="flex items-center gap-1">
              <MaterialIcon name="schedule" className="text-[1em]" />
              {format(new Date(event.starts_at), "EEEE d 'de' MMMM 'a' HH:mm", { locale: es })}
            </span>
            {event.ends_at && (
              <span className="flex items-center gap-1">
                <MaterialIcon name="event_available" className="text-[1em]" />
                hasta {format(new Date(event.ends_at), "HH:mm")}
              </span>
            )}
            {event.location_type !== "text_only" && (
              <span className="flex items-center gap-1">
                <MaterialIcon name={locationInfo.icon} className="text-[1em]" />
                {event.location_name || locationInfo.label}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isCancelled && (
            <span className="px-2 py-0.5 rounded-full text-label-xs font-medium bg-error-container text-on-error-container">
              Cancelado
            </span>
          )}
          {!isCancelled && event.in_progress && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-label-xs font-medium bg-primary text-on-primary">
              <span className="relative flex h-1.5 w-1.5" aria-hidden>
                <span className="absolute inline-flex h-full w-full rounded-full bg-on-primary/70 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-on-primary" />
              </span>
              En curso
            </span>
          )}
          {!isCancelled && !event.in_progress && isPast && (
            <span className="px-2 py-0.5 rounded-full text-label-xs font-medium bg-surface-container-high text-on-surface-variant">
              Finalizado
            </span>
          )}
          {!isCancelled && !event.in_progress && !isPast && (
            <span className="px-2 py-0.5 rounded-full text-label-xs font-medium bg-emerald-container text-on-emerald-container">
              Próximo
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="px-4 py-3 text-body-md text-on-surface-variant border-b border-outline-variant/10">
          {event.description}
        </div>
      )}

      {/* RSVP & Stats */}
      <div className="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        {/* RSVP Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-label-sm text-on-surface-variant shrink-0">Tu respuesta:</span>
          <div className="relative">
            {event.my_rsvp ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRsvpMenu(true)}
                className={`h-9 px-3 ${RSVP_LABELS[event.my_rsvp].color}`}
              >
                <MaterialIcon name={RSVP_LABELS[event.my_rsvp].icon} className="text-lg mr-1" />
                {RSVP_LABELS[event.my_rsvp].label}
                <MaterialIcon name="keyboard_arrow_down" className="text-lg ml-1" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRsvpMenu(true)}
                className="h-9 px-3"
              >
                <MaterialIcon name="keyboard_arrow_down" className="text-lg" />
                <span>Responder</span>
              </Button>
            )}
            {showRsvpMenu && (
              <div className="absolute bottom-full left-0 mb-2 z-[60] bg-surface-container-low rounded-xl border border-outline-variant/20 shadow-xl p-1 min-w-[140px]">
                {rsvpOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => handleRsvp(opt.value as RSVPStatus)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-body-md font-medium transition-colors hover:bg-surface-container-high ${
                      event.my_rsvp === opt.value ? `bg-${opt.color}-container/30 text-${opt.color}` : "text-on-surface"
                    }`}
                  >
                    <MaterialIcon name={RSVP_LABELS[opt.value as RSVPStatus].icon} className="text-lg" />
                    {opt.label}
                    {event.my_rsvp === opt.value && (
                      <MaterialIcon name="check" className="text-lg ml-auto" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats — tap to open the attendee census */}
        <button
          onClick={() => setShowCensus(true)}
          title="Ver asistentes"
          className="flex items-center gap-4 text-label-sm text-on-surface-variant shrink-0 rounded-full px-2 py-1 -mx-2 hover:bg-surface-container-high transition-colors"
        >
          {event.max_attendees && (
            <span className="flex items-center gap-1">
              <MaterialIcon name="groups" className="text-[1em]" />
              {totalAttendees}/{event.max_attendees}
            </span>
          )}
          <span className="flex items-center gap-1">
            <MaterialIcon name={RSVP_LABELS.going.icon} className="text-[1em] text-emerald-600" />
            {goingCount}
          </span>
          <span className="flex items-center gap-1">
            <MaterialIcon name={RSVP_LABELS.maybe.icon} className="text-[1em] text-amber-600" />
            {maybeCount}
          </span>
        </button>
      </div>

      {/* Reminder setting */}
      <div className="px-4 py-3 border-t border-outline-variant/10 bg-surface-container-low/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MaterialIcon name="notifications" className="text-on-surface-variant" />
            <span className="text-label-md text-on-surface-variant">Recordatorio:</span>
          </div>
          <div className="relative">
            <SelectField
              value={event.reminder_time || "1h"}
              onChange={(v) => onSetReminder(event.id, v as ReminderTime)}
              options={reminderOptions}
              placeholder="Seleccionar..."
              className="min-w-[160px]"
            />
          </div>
        </div>
      </div>

      {/* Voice channel join — available while upcoming and (crucially) in progress */}
      {(event.voice_channel_id || event.location_type === "voice_channel") && !isCancelled && (event.in_progress || !isPast) && (
        <div className="px-4 py-3 border-t border-outline-variant/10">
          <Button
            variant="primary"
            className="w-full"
            icon="mic"
            onClick={() => event.voice_channel_id && onJoinVoice?.(event.voice_channel_id)}
          >
            {event.voice_channel?.name ? `Unirse a "${event.voice_channel.name}"` : "Unirse al canal de voz"}
          </Button>
        </div>
      )}

      {/* Admin actions */}
      {canEdit && (
        <div className="px-4 py-3 border-t border-outline-variant/10 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onEdit(event)} icon="edit">
            Editar
          </Button>
          <Button variant="danger" size="sm" onClick={() => setShowDeleteConfirm(true)} icon="delete">
            Eliminar
          </Button>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <AdminCrudModal
          open={true}
          onClose={() => setShowDeleteConfirm(false)}
          title="Eliminar evento"
          saving={false}
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

      {/* RSVP Menu Portal */}
      {showRsvpMenu && (
        <div
          className="fixed inset-0 z-50 bg-transparent"
          onClick={() => setShowRsvpMenu(false)}
        />
      )}

      <EventCensusModal
        eventId={event.id}
        eventTitle={event.title}
        open={showCensus}
        onClose={() => setShowCensus(false)}
      />
    </div>
  );
}
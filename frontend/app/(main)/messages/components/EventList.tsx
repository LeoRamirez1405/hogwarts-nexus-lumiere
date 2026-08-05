"use client";

import { useState, useEffect, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import EmptyState from "@/components/ui/EmptyState";
import { eventsApi } from "@/lib/api/eventsApi";
import type { Event, EventCreate, EventUpdate, RSVPStatus, ReminderTime } from "@/lib/api/events";
import EventCard from "./EventCard";
import EventModal from "./EventModal";

interface EventListProps {
  roomId: string;
  currentUserId: string;
  isAdminOrMod: boolean;
  isVisible: boolean;
  onJoinVoice?: (channelId: string) => void;
}

/**
 * Admin/management panel for the room's single live event.
 *
 * The wall-facing UI lives in the top `EventLiveBanner` (RSVP, status, voice
 * join). This panel — opened from the chat menu "Ver eventos" — is where the
 * admin creates, edits, or deletes the room's one event at a time. Members
 * also see the current event details here.
 */
export default function EventList({
  roomId,
  currentUserId,
  isAdminOrMod,
  isVisible,
  onJoinVoice,
}: EventListProps) {
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

  const loadCurrent = useCallback(async () => {
    if (!isVisible) return;
    try {
      setLoading(true);
      setError(null);
      const ev = await eventsApi.getCurrent(roomId);
      setCurrentEvent(ev ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar el evento");
    } finally {
      setLoading(false);
    }
  }, [roomId, isVisible]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadCurrent();
  }, [loadCurrent]);

  // Keep in sync with banner-driven mutations (RSVP, status changes, etc.):
  // the WS push reloads the polled "current" event via this callback when
  // mutations in ChatPanel fire.
  const handleRsvp = async (eventId: string, status: RSVPStatus) => {
    try {
      await eventsApi.rsvp(eventId, status);
      await loadCurrent();
    } catch (err) {
      console.error("Error RSVP:", err);
    }
  };

  const handleRemoveRsvp = async (eventId: string) => {
    try {
      await eventsApi.removeRsvp(eventId);
      await loadCurrent();
    } catch (err) {
      console.error("Error removing RSVP:", err);
    }
  };

  const handleSetReminder = async (eventId: string, reminder: ReminderTime) => {
    try {
      await eventsApi.setReminder(eventId, reminder);
      await loadCurrent();
    } catch (err) {
      console.error("Error setting reminder:", err);
    }
  };

  const handleCreate = async (data: EventCreate) => {
    setModalLoading(true);
    try {
      await eventsApi.create(data);
      setShowModal(false);
      setEditingEvent(null);
      await loadCurrent();
    } catch (err) {
      throw err;
    } finally {
      setModalLoading(false);
    }
  };

  const handleUpdate = async (data: EventUpdate) => {
    setModalLoading(true);
    try {
      if (editingEvent) {
        await eventsApi.update(editingEvent.id, data);
        setShowModal(false);
        setEditingEvent(null);
        await loadCurrent();
      }
    } catch (err) {
      throw err;
    } finally {
      setModalLoading(false);
    }
  };

  const handleDelete = async (eventId: string) => {
    try {
      await eventsApi.delete(eventId);
      await loadCurrent();
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  const openCreateModal = () => {
    setEditingEvent(null);
    setShowModal(true);
  };

  const openEditModal = (event: Event) => {
    setEditingEvent(event);
    setShowModal(true);
  };

  if (!isVisible) {
    return (
      <div className="text-center py-12">
        <EmptyState
          icon="event_busy"
          title="Eventos deshabilitados"
          description="Un administrador ha desactivado la función de eventos globalmente."
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon name="event" className="text-primary text-xl" />
          <div>
            <h2 className="font-display text-headline-md text-on-surface">Eventos del grupo</h2>
            <p className="text-label-sm text-on-surface-variant">
              Organiza y participa en actividades con tu grupo
            </p>
          </div>
        </div>
      </div>

      {/* Single live event / empty state */}
      {loading ? (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-4 animate-pulse">
          <div className="h-6 bg-surface-container-high rounded w-3/4 mb-2" />
          <div className="h-4 bg-surface-container-high rounded w-1/2 mb-3" />
          <div className="flex gap-2">
            <div className="h-8 bg-surface-container-high rounded-full flex-1" />
            <div className="h-8 bg-surface-container-high rounded-full flex-1" />
            <div className="h-8 bg-surface-container-high rounded-full flex-1" />
          </div>
        </div>
      ) : error ? (
        <EmptyState
          icon="error"
          title="Error al cargar"
          description={error}
          actionLabel="Reintentar"
          onAction={() => loadCurrent()}
        />
      ) : currentEvent ? (
        <EventCard
          event={currentEvent}
          currentUserId={currentUserId}
          isAdminOrMod={isAdminOrMod}
          onRsvp={handleRsvp}
          onRemoveRsvp={handleRemoveRsvp}
          onSetReminder={handleSetReminder}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onJoinVoice={onJoinVoice}
        />
      ) : (
        <EmptyState
          icon="event_available"
          title="Sin eventos"
          description={
            isAdminOrMod
              ? "Crea un evento para tu grupo — todos lo verán en el banner superior del chat."
              : "Los administradores pueden crear eventos para el grupo."
          }
          actionLabel={isAdminOrMod ? "Crear evento" : undefined}
          onAction={openCreateModal}
        />
      )}

      {/* Create/Edit Modal */}
      <EventModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingEvent(null);
        }}
        onSubmit={async (data: EventCreate | EventUpdate) => {
          if (editingEvent) await handleUpdate(data as EventUpdate);
          else await handleCreate(data as EventCreate);
        }}
        initialData={editingEvent}
        roomId={roomId}
        isLoading={modalLoading}
        canCreateVoiceChannel={true}
      />
    </div>
  );
}

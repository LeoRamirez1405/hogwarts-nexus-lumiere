"use client";

import { useState, useEffect, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { eventsApi } from "@/lib/api/eventsApi";
import type { Event, EventCreate, EventUpdate, EventStatus, ReminderTime, RSVPStatus } from "@/lib/api/events";
import EventCard from "./EventCard";
import EventModal from "./EventModal";

interface EventListProps {
  roomId: string;
  currentUserId: string;
  isAdminOrMod: boolean;
  isVisible: boolean; // Global events feature toggle
  onJoinVoice?: (channelId: string) => void;
}

export default function EventList({
  roomId,
  currentUserId,
  isAdminOrMod,
  isVisible,
  onJoinVoice,
}: EventListProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EventStatus | "upcoming">("upcoming");

  const LIMIT = 20;

  const loadEvents = useCallback(async (append = false) => {
    if (!isVisible) return;
    
    try {
      if (!append) setLoading(true);
      else setLoadingMore(true);
      setError(null);

      const params: {
        room_id: string;
        limit: number;
        offset: number;
        status?: string;
        upcoming_only?: boolean;
      } = { room_id: roomId, limit: LIMIT, offset: append ? offset : 0 };
      if (statusFilter !== "upcoming") {
        params.status = statusFilter;
        params.upcoming_only = false;
      }

      const response = await eventsApi.list(params);
      
      if (append) {
        setEvents((prev) => [...prev, ...response.events]);
      } else {
        setEvents(response.events);
      }
      setHasMore(response.has_more);
      setOffset((prev) => prev + response.events.length);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al cargar eventos";
      setError(msg);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [roomId, isVisible, offset, statusFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadEvents(false);
  }, [loadEvents]);

  const handleCreate = async (data: EventCreate) => {
    setModalLoading(true);
    try {
      await eventsApi.create(data);
      setShowModal(false);
      setEditingEvent(null);
      await loadEvents(false);
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
        await loadEvents(false);
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
      await loadEvents(false);
    } catch (err) {
      console.error("Error deleting event:", err);
    }
  };

  const handleRsvp = async (eventId: string, status: RSVPStatus) => {
    try {
      await eventsApi.rsvp(eventId, status);
      // Optimistic update
      setEvents((prev) =>
        prev.map((e) =>
          e.id === eventId
            ? { ...e, my_rsvp: status, rsvp_counts: { ...e.rsvp_counts, [status]: (e.rsvp_counts?.[status] || 0) + 1 } }
            : e
        )
      );
    } catch (err) {
      console.error("Error RSVP:", err);
    }
  };

  const handleSetReminder = async (eventId: string, reminder: ReminderTime) => {
    try {
      await eventsApi.setReminder(eventId, reminder);
      setEvents((prev) =>
        prev.map((e) => (e.id === eventId ? { ...e, reminder_time: reminder } : e))
      );
    } catch (err) {
      console.error("Error setting reminder:", err);
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
      {/* Header with filter and create button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MaterialIcon name="event" className="text-primary text-xl" />
          <div>
            <h2 className="font-display text-headline-md text-on-surface">Eventos del grupo</h2>
            <p className="text-label-sm text-on-surface-variant">
              Organiza y participa en actividades con tu grupo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as EventStatus | "upcoming")}
            className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary text-sm"
          >
            <option value="upcoming">Próximos</option>
            <option value="published">Publicados</option>
            <option value="draft">Borradores</option>
            <option value="cancelled">Cancelados</option>
            <option value="completed">Finalizados</option>
          </select>

          {isAdminOrMod && (
            <Button variant="primary" icon="add" onClick={openCreateModal} size="md">
              Crear evento
            </Button>
          )}
        </div>
      </div>

      {/* Events list */}
      {loading ? (
        <div className="space-y-3" role="status" aria-label="Cargando eventos">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface-container-low rounded-2xl border border-outline-variant/20 p-4 animate-pulse">
              <div className="h-6 bg-surface-container-high rounded w-3/4 mb-2" />
              <div className="h-4 bg-surface-container-high rounded w-1/2 mb-3" />
              <div className="h-4 bg-surface-container-high rounded w-full mb-3" />
              <div className="flex gap-2">
                <div className="h-8 bg-surface-container-high rounded-full flex-1" />
                <div className="h-8 bg-surface-container-high rounded-full flex-1" />
                <div className="h-8 bg-surface-container-high rounded-full flex-1" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <EmptyState
          icon="error"
          title="Error al cargar"
          description={error}
          actionLabel="Reintentar"
          onAction={() => loadEvents(false)}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon="event_available"
          title={statusFilter === "upcoming" ? "No hay eventos próximos" : `No hay eventos ${statusFilter}`}
          description={
            statusFilter === "upcoming"
              ? isAdminOrMod
                ? "Crea el primer evento para tu grupo"
                : "Los administradores pueden crear eventos desde aquí"
              : "Prueba con otro filtro"
          }
          actionLabel={isAdminOrMod && statusFilter === "upcoming" ? "Crear evento" : undefined}
          onAction={openCreateModal}
        />
      ) : (
        <>
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                currentUserId={currentUserId}
                isAdminOrMod={isAdminOrMod}
                onRsvp={handleRsvp}
                onSetReminder={handleSetReminder}
                onEdit={openEditModal}
                onDelete={handleDelete}
                onJoinVoice={onJoinVoice}
              />
            ))}
          </div>

          {hasMore && (
            <div className="text-center pt-4">
              <Button
                variant="outline"
                onClick={() => loadEvents(true)}
                disabled={loadingMore}
                className="w-full sm:w-auto"
              >
                {loadingMore ? "Cargando..." : "Cargar más eventos"}
              </Button>
            </div>
          )}
        </>
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
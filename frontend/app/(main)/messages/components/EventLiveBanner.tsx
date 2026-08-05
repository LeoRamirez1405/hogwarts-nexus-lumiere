"use client";

import { MaterialIcon } from "@/components/ui";
import type { Event } from "@/lib/api/events";

interface EventLiveBannerProps {
  event: Event;
  onOpenCensus: () => void;
  onJoinVoice?: (channelId: string) => void;
}

/**
 * Slim "event in progress" banner, pinned above the pinned-messages bar.
 * Distinct accent styling so it reads as a live, happening-now thing.
 */
export default function EventLiveBanner({ event, onOpenCensus, onJoinVoice }: EventLiveBannerProps) {
  const going = event.rsvp_counts?.going || 0;
  const maybe = event.rsvp_counts?.maybe || 0;
  const attendees = going + maybe;

  return (
    <div className="w-full flex items-center gap-2 px-4 py-2 bg-primary/90 text-on-primary backdrop-blur-sm border-b border-primary/30">
      <span className="relative flex h-2.5 w-2.5 shrink-0" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-on-primary/70 opacity-75 animate-ping" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-on-primary" />
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-label-sm font-semibold truncate">
          Evento en curso · {event.title}
        </p>
      </div>

      <button
        onClick={onOpenCensus}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-on-primary/15 hover:bg-on-primary/25 transition-colors shrink-0"
        title="Ver asistentes"
      >
        <MaterialIcon name="groups" className="text-[1.05em]" />
        <span className="text-label-sm font-medium">{attendees}</span>
      </button>

      {event.voice_channel_id && onJoinVoice && (
        <button
          onClick={() => onJoinVoice(event.voice_channel_id!)}
          className="flex items-center gap-1 px-2 py-1 rounded-full bg-on-primary/15 hover:bg-on-primary/25 transition-colors shrink-0"
          title="Unirse al canal de voz"
        >
          <MaterialIcon name="mic" className="text-[1.05em]" />
        </button>
      )}
    </div>
  );
}

"use client";

import { MaterialIcon } from "../helpers";
import type { VoiceChannelBrief } from "@/lib/api/voice_channels";

interface ActiveVoiceBarProps {
  channel: VoiceChannelBrief;
  /** True when the current user is already connected to this channel. */
  isJoined: boolean;
  /** Join the active channel (acquires mic + connects). */
  onJoin: () => void;
  /** Open the full voice-channel panel (controls / leave). */
  onOpenPanel: () => void;
}

/**
 * Sticky call-to-action shown below the pinned messages whenever a voice chat
 * is active in the room, so any member can jump in quickly.
 */
export default function ActiveVoiceBar({
  channel,
  isJoined,
  onJoin,
  onOpenPanel,
}: ActiveVoiceBarProps) {
  return (
    <div className="w-full flex items-center gap-3 px-4 py-2 bg-primary-container/90 backdrop-blur-sm border-b border-primary/20">
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
      </span>
      <MaterialIcon name="graphic_eq" className="text-primary text-lg shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-label-md font-semibold text-on-primary-container truncate">
          Chat de voz activo · {channel.name}
        </p>
        <p className="text-label-sm text-on-primary-container/80">
          {channel.participant_count} participante{channel.participant_count !== 1 ? "s" : ""}
        </p>
      </div>
      {isJoined ? (
        <button
          onClick={onOpenPanel}
          className="px-4 py-1.5 rounded-full bg-surface-container-high text-on-surface text-label-md font-medium hover:bg-surface-container-highest transition-colors shrink-0"
        >
          Conectado
        </button>
      ) : (
        <button
          onClick={onJoin}
          className="px-4 py-1.5 rounded-full bg-primary text-on-primary text-label-md font-medium hover:bg-primary/90 transition-colors shrink-0 inline-flex items-center gap-1.5"
        >
          <MaterialIcon name="call" className="text-base" />
          Unirse
        </button>
      )}
    </div>
  );
}

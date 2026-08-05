"use client";

import { MaterialIcon } from "../helpers";
import VoiceChannelToggle from "./VoiceChannelToggle";

interface VoiceChannelPanelProps {
  roomId: string;
  isActive: boolean;
  isAdmin: boolean;
  onToggle: (roomId: string) => void;
  onRefresh: () => void;
  onClose: () => void;
}

export default function VoiceChannelPanel({
  roomId,
  isActive,
  isAdmin,
  onToggle,
  onRefresh,
  onClose,
}: VoiceChannelPanelProps) {
  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-low max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
        <p className="text-label-sm font-semibold text-on-surface">Chat de voz</p>
        <button
          onClick={onClose}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <MaterialIcon name="close" className="text-lg" />
        </button>
      </div>

      <div className="px-3 py-4 space-y-3">
        <div className="text-center py-2">
          <MaterialIcon
            name={isActive ? "mic" : "mic_off"}
            className={`text-6xl mx-auto ${isActive ? "text-primary" : "text-on-surface-variant"}`}
          />
        </div>

        <p className="text-body-md text-center text-on-surface">
          {isActive ? "Chat de voz activado" : "Chat de voz desactivado"}
        </p>

        <p className="text-label-sm text-center text-on-surface-variant">
          {isActive
            ? "Los miembros pueden unirse al chat de voz"
            : "Activa el chat de voz para permitir que los miembros se unan"}
        </p>

        <VoiceChannelToggle
          roomId={roomId}
          isActive={isActive}
          isAdmin={isAdmin}
          onToggle={onToggle}
          onRefresh={onRefresh}
        />
      </div>
    </div>
  );
}
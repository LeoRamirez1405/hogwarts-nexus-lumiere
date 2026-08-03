"use client";

import { useState, useEffect } from "react";
import { MaterialIcon } from "../helpers";
import { VoiceChannelBrief } from "@/lib/api/voice_channels";
import { voiceChannelsApi } from "@/lib/api/voice_channels";

interface VoiceChannelPanelProps {
  roomId: string;
  activeChannelId: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoEnabled: boolean;
  onJoin: (channelId: string) => void;
  onLeave: () => void;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleVideo: () => void;
  onClose: () => void;
}

export default function VoiceChannelPanel({
  roomId,
  activeChannelId,
  isMuted,
  isDeafened,
  isVideoEnabled,
  onJoin,
  onLeave,
  onToggleMute,
  onToggleDeafen,
  onToggleVideo,
  onClose,
}: VoiceChannelPanelProps) {
  const [channels, setChannels] = useState<VoiceChannelBrief[]>([]);
  const [newChannelName, setNewChannelName] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    voiceChannelsApi.listForRoom(roomId).then((list) => {
      if (!cancelled) {
        setChannels(list);
        setLoading(false);
      }
    }).catch((err) => {
      console.error("Failed to load voice channels", err);
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [roomId]);

  const loadChannels = async () => {
    const list = await voiceChannelsApi.listForRoom(roomId);
    setChannels(list);
    setLoading(false);
  };

  const handleCreate = async () => {
    const name = newChannelName.trim();
    if (!name) return;
    try {
      await voiceChannelsApi.create(roomId, { name });
      setNewChannelName("");
      setShowCreate(false);
      await loadChannels();
    } catch (err) {
      console.error("Failed to create voice channel", err);
    }
  };

  const handleDelete = async (channelId: string) => {
    if (!confirm("¿Eliminar este canal de voz?")) return;
    try {
      await voiceChannelsApi.delete(channelId);
      await loadChannels();
    } catch (err) {
      console.error("Failed to delete voice channel", err);
    }
  };

  const isConnected = activeChannelId !== null;

  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-low overflow-y-auto max-h-80">
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
        <h3 className="text-label-sm font-semibold text-on-surface flex items-center gap-2">
          <MaterialIcon name="voice_chat" className="text-lg text-primary" />
          Canales de voz
        </h3>
        <button
          onClick={onClose}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <MaterialIcon name="close" className="text-lg" />
        </button>
      </div>

      {activeChannelId && (
        <div className="flex items-center justify-center gap-4 py-3 px-4 bg-primary/10 border-y border-primary/20">
          <button
            onClick={onToggleMute}
            className={`w-12 h-12 inline-flex items-center justify-center rounded-full transition-all ${
              isMuted
                ? "bg-error-container text-on-error-container ring-2 ring-error/30"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
            title={isMuted ? "Activar micrófono" : "Silenciar micrófono"}
          >
            <MaterialIcon name={isMuted ? "mic_off" : "mic"} className="text-xl" />
          </button>

          <button
            onClick={onToggleDeafen}
            className={`w-12 h-12 inline-flex items-center justify-center rounded-full transition-all ${
              isDeafened
                ? "bg-error/20 text-on-error ring-2 ring-error/30"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
            title={isDeafened ? "Activar altavoz" : "Silenciar altavoz"}
          >
            <MaterialIcon name={isDeafened ? "headset_off" : "headset_mic"} className="text-xl" />
          </button>

          <button
            onClick={onToggleVideo}
            className={`w-12 h-12 inline-flex items-center justify-center rounded-full transition-all ${
              isVideoEnabled
                ? "bg-primary-container text-on-primary-container ring-2 ring-primary/30"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
            title={isVideoEnabled ? "Apagar cámara" : "Encender cámara"}
          >
            <MaterialIcon name={isVideoEnabled ? "videocam" : "videocam_off"} className="text-xl" />
          </button>

          <button
            onClick={onLeave}
            className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-error text-on-error hover:bg-error/80 transition-all"
            title="Salir del canal"
          >
            <MaterialIcon name="call_end" className="text-xl" />
          </button>
        </div>
      )}

      <div className="px-3 py-2 space-y-1">
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-2 px-3 rounded-lg bg-primary-container text-on-primary-container text-label-md font-medium hover:bg-primary-container/80 transition-colors flex items-center gap-2"
        >
          <MaterialIcon name="add" className="text-lg" />
          Crear canal de voz
        </button>

        {showCreate && (
          <div className="flex gap-2">
            <input
              type="text"
              value={newChannelName}
              onChange={(e) => setNewChannelName(e.target.value)}
              placeholder="Nombre del canal..."
              className="flex-1 px-3 py-1.5 rounded-lg bg-surface text-on-surface text-body-md border border-outline-variant/30 focus:outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
                if (e.key === "Escape") setShowCreate(false);
              }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              disabled={!newChannelName.trim()}
              className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-body-md font-medium disabled:opacity-40 transition-colors"
            >
              Crear
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface-variant text-body-md hover:bg-surface-container-high/80"
            >
              Cancelar
            </button>
          </div>
        )}

        {channels.length === 0 && !loading && (
          <p className="text-body-sm text-on-surface-variant text-center py-4">
            No hay canales de voz activos. ¡Crea uno!
          </p>
        )}

        {channels.map((ch) => {
          const isActive = activeChannelId === ch.id;

          return (
            <div
              key={ch.id}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary-container/30 border border-primary/20"
                  : "bg-surface-container-high/50 hover:bg-surface-container-high"
              }`}
            >
              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <div
                  className={`w-6 h-6 inline-flex items-center justify-center rounded-full ${
                    isActive ? "bg-primary-container text-primary" : "bg-surface-container-high text-on-surface-variant"
                  }`}
                >
                  <MaterialIcon name="music_note" className="text-sm" />
                </div>
                <div className="min-w-0">
                  <p className="text-body-md text-on-surface font-medium truncate">
                    {ch.name}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {ch.participant_count} participante{ch.participant_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2">
                <button
                  onClick={() => handleDelete(ch.id)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-error-container/30 text-on-surface-variant hover:text-error transition-colors"
                  title="Eliminar canal"
                >
                  <MaterialIcon name="delete" className="text-sm" />
                </button>

                {isActive ? (
                  <button
                    onClick={onLeave}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-error-container text-on-error-container hover:bg-error-container/80 transition-colors"
                    title="Salir del canal"
                  >
                    <MaterialIcon name="call_end" className="text-sm" />
                  </button>
                ) : (
                  <button
                    onClick={() => onJoin(ch.id)}
                    className="px-3 py-1 rounded-full bg-primary text-on-primary text-label-sm font-medium hover:bg-primary/80 transition-colors"
                    disabled={isConnected}
                  >
                    {isConnected ? "Ocupado" : "Conectar"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

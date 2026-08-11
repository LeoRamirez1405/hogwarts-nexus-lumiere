"use client";

import { useState, useEffect } from "react";
import { api, Message } from "@/lib/api";
import { MaterialIcon, formatMessageTime } from "./helpers";
import { Avatar, BottomSheet } from "@/components/ui";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

export default function StarredMessagesModal({
  onSelectMessage,
  onClose,
}: {
  onSelectMessage: (msg: Message) => void;
  onClose: () => void;
}) {
  const isDesktop = useIsDesktopMdUp(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .getStarredMessages()
      .then((msgs) => {
        if (cancelled) return;
        setMessages(msgs);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const unstar = async (msg: Message) => {
    try {
      await api.toggleStar(msg.id);
      setMessages((prev) => prev.filter((m) => m.id !== msg.id));
    } catch (error) {
      console.error('Failed to unstar message:', error);
    }
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="py-12 text-center">
          <MaterialIcon
            name="progress_activity"
            className="text-4xl text-outline-variant animate-spin mb-2 block mx-auto"
          />
          <p className="text-on-surface-variant text-body-md">
            Cargando destacados
          </p>
        </div>
      );
    }
    if (messages.length === 0) {
      return (
        <div className="py-12 text-center">
          <MaterialIcon
            name="star_outline"
            className="text-4xl text-outline-variant mb-2 block mx-auto"
          />
          <p className="text-on-surface-variant text-body-md">
            Aún no tienes mensajes destacados
          </p>
          <p className="text-on-surface-variant/60 text-label-sm mt-1">
            Mantén presionado un mensaje y toca la estrella
          </p>
        </div>
      );
    }
    return (
      <div>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className="flex items-start gap-3 px-6 py-3 hover:bg-surface-container-high transition-colors cursor-pointer"
            onClick={() => onSelectMessage(msg)}
          >
            <Avatar
              src={msg.sender?.avatar_url}
              alt={msg.sender?.name || "?"}
              size="sm"
              initials={(msg.sender?.name || "?").slice(0, 2).toUpperCase()}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-body-md font-medium text-on-surface truncate">
                  {msg.sender?.name || "Alguien"}
                </p>
                <span className="text-label-sm text-on-surface-variant shrink-0">
                  {formatMessageTime(msg.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-label-md text-on-surface-variant truncate flex-1">
                  {msg.body?.slice(0, 80) ||
                    (msg.kind === "image"
                      ? "📷 Imagen"
                      : msg.kind === "video"
                      ? "🎥 Video"
                      : msg.kind === "audio"
                      ? "🎵 Audio"
                      : msg.kind === "voice"
                      ? "🎤 Nota de voz"
                      : msg.kind === "sticker"
                      ? "😀 Sticker"
                      : msg.kind === "document"
                      ? "📄 Documento"
                      : msg.kind === "poll"
                      ? "📊 Encuesta"
                      : "Adjunto")}
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    unstar(msg);
                  }}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-warning transition-colors shrink-0"
                  title="Quitar de destacados"
                >
                  <MaterialIcon name="star" className="text-lg" filled />
                </button>
              </div>
              {msg.room && (
                <span className="inline-flex items-center text-label-sm px-3 py-1 rounded-full bg-primary/10 text-primary mt-1">
                  {msg.room.name}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (isDesktop) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
            <h2 className="font-display text-title-md text-on-surface flex items-center gap-2">
              <MaterialIcon name="star" className="text-warning" filled />
              Mensajes destacados
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            >
              <MaterialIcon name="close" className="text-xl" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar">{renderList()}</div>
        </div>
      </div>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title="Mensajes destacados">
      {renderList()}
    </BottomSheet>
  );
}
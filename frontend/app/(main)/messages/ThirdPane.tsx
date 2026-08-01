"use client";

import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { Conversation, Message } from "@/lib/api";
import { api } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui";
import { MaterialIcon, getInitials } from "./helpers";

export default function ThirdPane({
  selectedConv,
  messageCount,
}: {
  selectedConv: Conversation;
  messageCount: number;
}) {
  const [showMedia, setShowMedia] = useState(false);
  const [mediaItems, setMediaItems] = useState<Message[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const convId = selectedConv?.id;
  const convType = selectedConv?.type;

  useEffect(() => {
    if (!showMedia || !convId) return;

    let cancelled = false;

    const loadMedia = async () => {
      setLoadingMedia(true);
      try {
        const items = convType === "room"
          ? await api.getRoomMedia(convId, 100)
          : await api.getDmMedia(convId, 100);
        if (!cancelled) {
          setMediaItems(items);
        }
      } catch (err) {
        console.error("Failed to load media", err);
      } finally {
        if (!cancelled) {
          setLoadingMedia(false);
        }
      }
    };

    loadMedia();

    return () => {
      cancelled = true;
    };
  }, [showMedia, convId, convType]);

  return (
    <div className="hidden 2xl:flex flex-col w-72 border-l border-outline-variant/20 bg-surface-container-low p-6 overflow-y-auto no-scrollbar">
      <div className="text-center mb-6">
        <Avatar
          src={selectedConv.avatar_url}
          alt={selectedConv.name}
          size="lg"
          className="mx-auto mb-3"
          initials={getInitials(selectedConv.name)}
        />
        <h3 className="font-display text-title-md text-on-surface">
          {selectedConv.name}
        </h3>
        <p className="text-label-sm text-on-surface-variant">
          {selectedConv.subtitle ?? selectedConv.email ?? "Conversacion"}
        </p>
        {selectedConv.house && (
          <div className="mt-2">
            <Badge variant="tag" color="primary">{selectedConv.house}</Badge>
        </div>
        )}
      </div>
      <div className="space-y-4">
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Zerines
          </p>
          <p className="font-display text-headline-lg text-secondary">
            {selectedConv.zerines?.toLocaleString() ?? "0"}
          </p>
        </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Mensajes
          </p>
          <p className="font-display text-headline-lg text-primary">
            {messageCount}
          </p>
        </div>
        <Link
          href={`/profile/${selectedConv.id}`}
          className="w-full flex items-center justify-center gap-2 border border-outline-variant/30 rounded-xl py-3 text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <MaterialIcon name="person" className="text-xl" />
          Ver perfil
        </Link>
        <div className="border-t border-outline-variant/20 pt-4">
          <button
            onClick={() => setShowMedia(!showMedia)}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-body-md font-medium transition-colors ${
              showMedia
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            <MaterialIcon name={showMedia ? "photo_library" : "photo_library"} className="text-xl" />
            {showMedia ? "Ocultar galería" : "Ver galería"}
          </button>
          {showMedia && (
            <div className="mt-3 space-y-2 max-h-96 overflow-y-auto no-scrollbar">
              {loadingMedia ? (
                <div className="flex justify-center py-4">
                  <MaterialIcon name="progress_activity" className="text-xl text-outline-variant animate-spin" />
                </div>
              ) : mediaItems.length === 0 ? (
                <p className="text-center text-label-sm text-on-surface-variant py-4">
                  No hay elementos multimedia
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {mediaItems.map((item) => (
                    <button
                      key={item.id}
                      className="aspect-square rounded-lg overflow-hidden bg-surface-container-high relative group"
                      onClick={() => {
                        // Could open full-screen viewer
                      }}
                    >
                      {item.kind === "image" && item.attachment_url && (
                        <Image
                          src={item.attachment_url}
                          alt={item.body || "Imagen"}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      )}
                      {item.kind === "video" && item.attachment_url && (
                        <video
                          src={item.attachment_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      )}
                      {item.kind === "document" && (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <MaterialIcon name="description" className="text-3xl text-primary" />
                        </div>
                      )}
                      {item.kind === "audio" && (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <MaterialIcon name="music_note" className="text-3xl text-secondary" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <MaterialIcon name="zoom_in" className="text-white text-xl" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

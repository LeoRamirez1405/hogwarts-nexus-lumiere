"use client";

import { MaterialIcon } from "../helpers";
import type { Message } from "@/lib/api";

export function previewOf(m: Message): string {
  if (m.kind === "sticker") return `Sticker ${m.body || ""}`;
  if (m.kind === "poll") return `Encuesta: ${m.poll?.question || ""}`;
  if (m.kind === "voice") return "Nota de voz";
  if (m.kind === "image") return "Imagen";
  if (m.kind === "video") return "Video";
  if (m.kind === "document") return m.attachment_name || "Documento";
  if (m.kind === "post") return "Publicacion compartida";
  return m.body || "";
}

interface PinnedMessagesBarProps {
  pinnedMessages: Message[];
  showPinned: boolean;
  onToggle: () => void;
  onSelectMessage: (msg: Message) => void;
  onUnpin?: (msg: Message) => void;
}

export default function PinnedMessagesBar({
  pinnedMessages,
  showPinned,
  onToggle,
  onSelectMessage,
  onUnpin,
}: PinnedMessagesBarProps) {
  return (
    <div className="w-full">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2 bg-surface-container-high/95 backdrop-blur-sm border-b border-outline-variant/20 text-left hover:bg-surface-container-highest transition-colors"
      >
        <MaterialIcon name="push_pin" className="text-primary text-lg" filled />
        <span className="text-label-sm font-medium text-on-surface flex-1 truncate">
          {pinnedMessages.length} mensaje{pinnedMessages.length !== 1 ? "s" : ""} fijado{pinnedMessages.length !== 1 ? "s" : ""}
        </span>
        <MaterialIcon
          name={showPinned ? "expand_less" : "expand_more"}
          className="text-on-surface-variant text-lg"
        />
      </button>
      {showPinned && (
        <div className="bg-surface-container/95 backdrop-blur-sm border-b border-outline-variant/20 max-h-56 overflow-y-auto divide-y divide-outline-variant/10">
          {pinnedMessages.map((pm) => (
            <div
              key={pm.id}
              className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container-high/60"
            >
              <button
                onClick={() => {
                  onToggle();
                  onSelectMessage(pm);
                }}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-label-sm font-semibold text-on-surface truncate">
                  {pm.sender?.name || "Alguien"}
                </p>
                <p className="text-label-sm text-on-surface-variant truncate">
                  {previewOf(pm)}
                </p>
              </button>
              {onUnpin && (
                <button
                  onClick={() => onUnpin(pm)}
                  title="Dejar de fijar"
                  className="p-1 rounded-full hover:bg-surface-container-highest text-on-surface-variant shrink-0"
                >
                  <MaterialIcon name="push_pin" className="text-base" filled />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

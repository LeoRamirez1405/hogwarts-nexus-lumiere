"use client";

import type { ReplyPreviewProps } from "./types";

export const ReplyPreview = ({ message, onScrollToMessage }: ReplyPreviewProps) => {
  if (!message.reply_to) return null;
  const r = message.reply_to;
  const senderName = r.sender?.name || "Alguien";
  let preview = r.body || "";
  if (r.kind === "sticker") preview = `Sticker: ${r.body}`;
  else if (r.kind === "poll") preview = `Encuesta: ${r.poll?.question || ""}`;
  else if (r.kind === "voice") preview = "Nota de voz";
  else if (r.kind === "image") preview = "Imagen";
  else if (r.kind === "video") preview = "Video";
  else if (r.kind === "document") preview = r.attachment_name || "Documento";
  else if (r.kind === "post") preview = "Publicacion compartida";
  if (preview.length > 60) preview = preview.slice(0, 60) + "...";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onScrollToMessage && message.reply_to_id) onScrollToMessage(message.reply_to_id);
      }}
      className="mb-2 pl-3 border-l-3 border-current/40 bg-white/10 rounded-r-lg px-3 py-1.5 -mt-1 w-full text-left hover:bg-white/20 transition-colors cursor-pointer"
    >
      <p className="text-label-sm font-semibold opacity-90">{senderName}</p>
      <p className="text-label-sm opacity-70 truncate">{preview}</p>
    </button>
  );
};
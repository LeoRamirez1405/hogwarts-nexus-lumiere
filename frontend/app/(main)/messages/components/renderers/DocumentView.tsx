"use client";

import { MaterialIcon } from "@/components/ui";
import { getFileIcon, formatFileSize } from "@/app/(main)/messages/helpers";
import type { DocumentViewProps } from "./types";

export const DocumentView = ({ message, isOwn }: DocumentViewProps) => {
  const icon = getFileIcon(message.attachment_type || "");
  const name = message.attachment_name || "Documento";
  const size = message.metadata?.size ? formatFileSize(message.metadata.size) : "";

  return (
    <a
      href={message.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl border w-fit ${
        isOwn ? "bg-white/15 border-white/20" : "bg-white border-outline-variant/20"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
          isOwn ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
        }`}
      >
        <MaterialIcon name={icon} className="text-2xl" />
      </div>
      <div className="min-w-0">
        <p className={`text-body-md truncate max-w-xs ${isOwn ? "text-white" : "text-on-surface"}`}>{name}</p>
        <p className={`text-label-sm ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>{size}</p>
      </div>
      <MaterialIcon name="open_in_new" className={isOwn ? "text-white/70" : "text-on-surface-variant"} />
    </a>
  );
};
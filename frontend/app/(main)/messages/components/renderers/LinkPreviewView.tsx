"use client";

import Image from "next/image";
import { mediaSrc } from "@/lib/media";
import type { LinkPreviewResponse } from "@/lib/api";

interface LinkPreviewViewProps {
  preview: LinkPreviewResponse;
  isOwn: boolean;
}

export const LinkPreviewView = ({ preview, isOwn }: LinkPreviewViewProps) => {
  const { url, title, description, image, site_name } = preview;
  const domain = (() => {
    try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
  })();

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded-xl overflow-hidden border ${
        isOwn ? "border-white/20 bg-white/10" : "border-outline-variant/30 bg-surface-container-low"
      } hover:brightness-95 transition cursor-pointer`}
    >
      {image && (
        <div className="relative w-full h-40">
          <Image
            src={mediaSrc(image)}
            alt={title || "Preview"}
            fill
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      <div className="p-3">
        {site_name && (
          <span className={`text-[10px] font-medium uppercase tracking-wide ${isOwn ? "text-white/50" : "text-on-surface-variant"}`}>
            {site_name}
          </span>
        )}
        {title && (
          <p className={`text-label-sm font-semibold line-clamp-2 mt-0.5 ${isOwn ? "text-white" : "text-on-surface"}`}>
            {title}
          </p>
        )}
        {description && (
          <p className={`text-[12px] line-clamp-2 mt-1 ${isOwn ? "text-white/60" : "text-on-surface-variant"}`}>
            {description}
          </p>
        )}
        <p className={`text-[10px] mt-1.5 truncate ${isOwn ? "text-white/40" : "text-on-surface-variant/60"}`}>
          {domain}
        </p>
      </div>
    </a>
  );
};
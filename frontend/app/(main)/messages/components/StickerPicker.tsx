"use client";

import { STICKER_PACKS } from "../helpers";

interface StickerPickerProps {
  tab: string;
  onTabChange: (tab: string) => void;
  onSendSticker: (sticker: string) => void;
}

export default function StickerPicker({ tab, onTabChange, onSendSticker }: StickerPickerProps) {
  return (
    <div className="mb-2 bg-surface-container rounded-xl p-3 max-h-48 overflow-y-auto">
      <div className="flex gap-1 mb-2 border-b border-outline-variant/20 pb-2 overflow-x-auto no-scrollbar">
        {Object.keys(STICKER_PACKS).map((pack) => (
          <button
            key={pack}
            onClick={() => onTabChange(pack)}
            className={`px-3 py-1 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
              tab === pack
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            {pack.charAt(0).toUpperCase() + pack.slice(1)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1">
        {STICKER_PACKS[tab].map((s, i) => (
          <button
            key={`${i}-${s}`}
            onClick={() => onSendSticker(s)}
            className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-2xl hover:bg-surface-container-high transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

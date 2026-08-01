"use client";

import type { StickerViewProps } from "./types";

export const StickerView = ({ sticker }: StickerViewProps) => (
  <div className="text-6xl select-none" style={{ lineHeight: 1 }}>
    {sticker}
  </div>
);
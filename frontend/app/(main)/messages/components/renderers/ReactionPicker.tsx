"use client";

import { useState, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { STICKER_PACKS } from "@/app/(main)/messages/helpers";
import { FloatingPopover } from "../FloatingPopover";
import type { ReactionPickerProps } from "./types";

export const ReactionPicker = ({ messageId, onReacted }: ReactionPickerProps) => {
  const [showQuick, setShowQuick] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const anchorRef = useRef<HTMLButtonElement>(null);

  const handleReact = async (emoji: string) => {
    try {
      await api.addReaction(messageId, emoji);
      setShowQuick(false);
      setShowFull(false);
      onReacted?.();
    } catch (e) {
      console.error("Reaction failed", e);
    }
  };

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const quickContent = (
    <div className="flex gap-1" onClick={stop} onMouseDown={stop}>
      {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
        <button
          key={emoji}
          onMouseDown={stop}
          onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
          className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
      <button
        onMouseDown={stop}
        onClick={(e) => {
          e.stopPropagation();
          setShowQuick(false);
          setShowFull(true);
        }}
        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
      >
        <MaterialIcon name="more_horiz" className="text-lg" />
      </button>
    </div>
  );

  const fullContent = (
    <div className="flex flex-wrap gap-1" onClick={stop} onMouseDown={stop}>
      {Object.values(STICKER_PACKS)
        .flat()
        .map((emoji, i) => (
          <button
            key={`${i}-${emoji}`}
            onMouseDown={stop}
            onClick={(e) => { e.stopPropagation(); handleReact(emoji); }}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
          >
            {emoji}
          </button>
        ))}
    </div>
  );

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        onClick={() => setShowQuick(!showQuick)}
        className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        title="Reaccionar"
      >
        <MaterialIcon name="add_reaction" className="text-lg" />
      </button>
      <FloatingPopover
        anchorRef={anchorRef}
        open={showQuick}
        onRequestClose={() => setShowQuick(false)}
        placement="top"
        align="end"
        gap={6}
        maxHeight={200}
        className="w-auto"
      >
        {quickContent}
      </FloatingPopover>
      <FloatingPopover
        anchorRef={anchorRef}
        open={showFull}
        onRequestClose={() => setShowFull(false)}
        placement="top"
        align="end"
        gap={6}
        maxHeight={400}
        className="w-64"
      >
        {fullContent}
      </FloatingPopover>
    </div>
  );
};
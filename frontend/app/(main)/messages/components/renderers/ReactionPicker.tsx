"use client";

import { useState, useEffect, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import { api } from "@/lib/api";
import { STICKER_PACKS } from "@/app/(main)/messages/helpers";
import type { ReactionPickerProps } from "./types";

export const ReactionPicker = ({ messageId, onReacted }: ReactionPickerProps) => {
  const [showPicker, setShowPicker] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
        setShowFull(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleReact = async (emoji: string) => {
    try {
      await api.addReaction(messageId, emoji);
      setShowPicker(false);
      setShowFull(false);
      onReacted?.();
    } catch (e) {
      console.error("Reaction failed", e);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
        title="Reaccionar"
      >
        <MaterialIcon name="add_reaction" className="text-lg" />
      </button>
      {showPicker && (
        <div className="absolute bottom-full right-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl py-2 px-2 z-30 flex gap-1">
          {["👍", "❤️", "😂", "😮", "😢", "🙏"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowFull(!showFull)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="more_horiz" className="text-lg" />
          </button>
        </div>
      )}
      {showFull && (
        <div className="absolute bottom-full right-0 mb-2 mt-1 bg-surface-container-highest rounded-xl shadow-xl py-3 px-3 z-30 w-64 max-h-48 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {Object.values(STICKER_PACKS)
              .flat()
              .map((emoji, i) => (
                <button
                  key={`${i}-${emoji}`}
                  onClick={() => handleReact(emoji)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};
"use client";

import { useRef, useState } from "react";
import * as RadixPopover from "@radix-ui/react-popover";
import { MaterialIcon } from "./MaterialIcon";
import { useReactions } from "./useReactions";
import type { ReactionTargetType } from "@/lib/api";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const MORE_REACTIONS = [
  "🔥", "💜", "👏", "🎉", "🤔", "🙌", "😍", "😡",
  "✨", "🪄", "🧙", "🧙‍♀️", "🧙‍♂️", "🦉", "🐍", "🦁", "🦅", "🦡",
  "⚡", "💯", "👻", "🎃", "🏆", "💎", "🌙", "⭐", "📜", "🖋️",
];

interface ReactionBarProps {
  targetType: ReactionTargetType;
  targetId: string;
  className?: string;
}

export function ReactionBar({
  targetType,
  targetId,
  className = "",
}: ReactionBarProps) {
  const { items, toggle } = useReactions(targetType, targetId);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const pickerBtnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = async (emoji: string) => {
    setPickerOpen(false);
    await toggle(emoji);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      {items.map((item) => (
        <button
          key={item.emoji}
          onClick={() => void handleToggle(item.emoji)}
          title={item.user_names.join(", ") || item.emoji}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm transition-colors ${
            item.reacted_by_me
              ? "bg-primary/15 border border-primary/30 text-primary"
              : "bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest"
          }`}
        >
          <span className="text-sm">{item.emoji}</span>
          {item.count > 1 && <span>{item.count}</span>}
        </button>
      ))}
      <RadixPopover.Root open={pickerOpen} onOpenChange={setPickerOpen}>
        <RadixPopover.Trigger asChild>
          <button
            ref={pickerBtnRef}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Reaccionar"
          >
            <MaterialIcon name="add_reaction" className="text-lg" />
          </button>
        </RadixPopover.Trigger>
        <RadixPopover.Portal>
          <RadixPopover.Content
            side="top"
            align="end"
            sideOffset={6}
            className="z-[100] rounded-xl bg-surface-container-highest p-2 shadow-xl border border-outline-variant/20 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <div
              className="flex flex-wrap gap-1 max-w-[260px]"
              onClick={(e) => e.stopPropagation()}
            >
              {expanded
                ? MORE_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => void handleToggle(emoji)}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))
                : QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => void handleToggle(emoji)}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
              <button
                onClick={() => setExpanded((v) => !v)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
                title={expanded ? "Menos emojis" : "Más emojis"}
              >
                <MaterialIcon
                  name={expanded ? "expand_less" : "more_horiz"}
                  className="text-lg"
                />
              </button>
            </div>
          </RadixPopover.Content>
        </RadixPopover.Portal>
      </RadixPopover.Root>
    </div>
  );
}

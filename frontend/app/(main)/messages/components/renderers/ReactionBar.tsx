"use client";

import { useState, useRef } from "react";
import { api } from "@/lib/api";
import type { MessageReaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { ReactionBarProps } from "./types";

export const ReactionBar = ({ reactions, messageId, onReacted }: ReactionBarProps) => {
  const { user } = useAuthStore();
  const [localReactions, setLocalReactions] = useState<MessageReaction[]>(reactions);
  const tempIdRef = useRef(0);

  const grouped: Record<string, { count: number; users: string[] }> = {};
  for (const r of localReactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, users: [] };
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user_id);
  }

  if (Object.keys(grouped).length === 0) return null;

  const handleReactionClick = async (emoji: string) => {
    const myReaction = localReactions.find((r) => r.emoji === emoji && r.user_id === user?.id);
    if (myReaction) {
      setLocalReactions((prev) => prev.filter((r) => !(r.emoji === emoji && r.user_id === user?.id)));
      try {
        await api.removeReaction(messageId, emoji);
        onReacted?.();
      } catch (error) {
        console.error('Failed to remove reaction:', error);
        setLocalReactions(reactions);
      }
    } else {
      tempIdRef.current += 1;
      const tempId = `temp-${tempIdRef.current}`;
      const tempReaction: MessageReaction = {
        id: tempId,
        message_id: messageId,
        user_id: user?.id || "",
        emoji,
        created_at: new Date().toISOString(),
      };
      setLocalReactions((prev) => [...prev, tempReaction]);
      try {
        const result = await api.addReaction(messageId, emoji);
        if ("removed" in result) {
          setLocalReactions((prev) => prev.filter((r) => !(r.emoji === emoji && r.user_id === user?.id)));
        }
        onReacted?.();
      } catch (error) {
        console.error('Failed to add reaction:', error);
        setLocalReactions(reactions);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, data]) => {
        const iReacted = data.users.includes(user?.id || "");
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm transition-colors ${
              iReacted
                ? "bg-primary/15 border border-primary/30 text-primary"
                : "bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            <span className="text-sm">{emoji}</span>
            {data.count > 1 && <span>{data.count}</span>}
          </button>
        );
      })}
    </div>
  );
};
"use client";

import { useState, useRef, useMemo } from "react";
import { api } from "@/lib/api";
import type { MessageReaction } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import type { ReactionBarProps } from "./types";

export const ReactionBar = ({ reactions, messageId, onReacted }: ReactionBarProps) => {
  const { user } = useAuthStore();
  // Merge optimistic temp reactions with prop reactions
  const [tempReactions, setTempReactions] = useState<{ id: string; reaction: MessageReaction }[]>([]);
  const tempIdRef = useRef(0);

  // Combine prop reactions with optimistic temp additions (dedup by emoji+user_id)
  const localReactions = useMemo(() => {
    const seen = new Set(reactions.map((r) => `${r.emoji}-${r.user_id}`));
    const extras = tempReactions
      .filter((t) => !seen.has(`${t.reaction.emoji}-${t.reaction.user_id}`))
      .map((t) => t.reaction);
    return [...reactions, ...extras];
  }, [reactions, tempReactions]);

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
      setTempReactions((prev) => prev.filter((t) => !(t.reaction.emoji === emoji && t.reaction.user_id === user?.id)));
      try {
        await api.removeReaction(messageId, emoji);
        onReacted?.();
      } catch (error) {
        console.error('Failed to remove reaction:', error);
        setTempReactions([]);
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
      setTempReactions((prev) => [...prev, { id: tempId, reaction: tempReaction }]);
      try {
        const result = await api.addReaction(messageId, emoji);
        if ("removed" in result) {
          setTempReactions((prev) => prev.filter((t) => t.id !== tempId));
        }
        onReacted?.();
      } catch (error) {
        console.error('Failed to add reaction:', error);
        setTempReactions((prev) => prev.filter((t) => t.id !== tempId));
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
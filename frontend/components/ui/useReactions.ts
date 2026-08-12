"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { ReactionList, ReactionTargetType } from "@/lib/api";

/** Shared state for emoji reactions on any content type (post, comment, thread...). */
export function useReactions(targetType: ReactionTargetType, targetId: string) {
  const [items, setItems] = useState<ReactionList["items"]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    api
      .getReactions(targetType, targetId)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
      })
      .catch((e) => {
        console.error("Failed to load reactions:", e);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [targetType, targetId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(
    (emoji: string) => {
      api
        .toggleReaction(targetType, targetId, emoji)
        .then(() => refresh())
        .catch((e) => {
          console.error("Failed to toggle reaction:", e);
        });
    },
    [targetType, targetId, refresh]
  );

  return { items, total, loading, toggle, refresh };
}

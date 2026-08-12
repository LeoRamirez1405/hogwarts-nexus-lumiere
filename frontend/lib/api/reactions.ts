import { request, buildQuery } from "./core";
import { refreshUserLevelThrottled } from "../levelUp";

export type ReactionTargetType =
  | "post_comment"
  | "forum_thread"
  | "forum_comment"
  | "article"
  | "article_comment";

export interface ReactionToggleResult {
  id: string;
  target_type: string;
  target_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  removed: boolean;
}

export interface ReactionSummaryItem {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
  user_names: string[];
}

export interface ReactionList {
  items: ReactionSummaryItem[];
  total: number;
}

export const reactionsApi = {
  toggleReaction: (
    targetType: ReactionTargetType,
    targetId: string,
    emoji: string
  ) => {
    refreshUserLevelThrottled();
    return request<ReactionToggleResult>("/reactions/", {
      method: "POST",
      body: JSON.stringify({ target_type: targetType, target_id: targetId, emoji }),
    });
  },

  getReactions: (targetType: ReactionTargetType, targetId: string) =>
    request<ReactionList>(
      `/reactions/` + buildQuery({ target_type: targetType, target_id: targetId })
    ),
};

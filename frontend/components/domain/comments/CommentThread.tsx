"use client";

import { memo, useState } from "react";
import Link from "next/link";
import { Avatar, MaterialIcon, ReactionBar } from "@/components/ui";
import type { User, ReactionTargetType } from "@/lib/api";
import { toastError } from "@/lib/toastStore";
import { hapticLight } from "@/lib/haptics";

export interface ThreadComment {
  id: string;
  user_id: string;
  author?: User;
  body: string;
  created_at: string;
  replies?: ThreadComment[];
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

/** Total comments in a tree (roots + nested replies). */
export function countComments(list: ThreadComment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies ?? []), 0);
}

/** Immutably attach a new reply under the comment with id `parentId`. */
export function appendReply<T extends ThreadComment>(
  list: T[],
  parentId: string,
  reply: T
): T[] {
  const hasReply = list.some((c) =>
    c.replies?.some((r) => r.id === reply.id)
  );
  if (hasReply) return list;
  return list.map((c) => {
    if (c.id === parentId) {
      return { ...c, replies: [...(c.replies ?? []), reply] };
    }
    const nested = c.replies?.length
      ? appendReply(c.replies as T[], parentId, reply)
      : null;
    return nested ? { ...c, replies: nested } : c;
  });
}

interface CommentNodeProps {
  comment: ThreadComment;
  currentUser?: User | null;
  onReply: (parentId: string, body: string) => Promise<void>;
  timeAgo: (dateStr: string) => string;
  depth?: number;
  reactionTargetType?: ReactionTargetType;
}

function CommentNode({
  comment,
  currentUser,
  onReply,
  timeAgo,
  depth = 0,
  reactionTargetType,
}: CommentNodeProps) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const replies = comment.replies ?? [];

  const submitReply = async () => {
    const text = replyText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await onReply(comment.id, text);
      setReplyText("");
      setReplying(false);
    } catch (e) {
      toastError("No se pudo enviar la respuesta", e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Link
          href={`/profile/${comment.user_id}`}
          className="shrink-0 group"
          aria-label={comment.author?.name ?? "Ver perfil"}
        >
          <Avatar
            size="sm"
            src={comment.author?.avatar_url}
            alt={comment.author?.name}
            initials={initialsOf(comment.author?.name)}
            className="w-8! h-8!"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-surface-container-low rounded-xl px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <Link
                href={`/profile/${comment.user_id}`}
                className="text-label-sm font-semibold text-on-surface hover:text-primary transition-colors truncate"
              >
                {comment.author?.name ?? "Usuario"}
              </Link>
              <span className="text-label-xs text-on-surface-variant shrink-0">
                {timeAgo(comment.created_at)}
              </span>
            </div>
            <p className="text-body-md text-on-surface break-words">
              {comment.body}
            </p>
          </div>
          {currentUser && (
            <button
              onClick={() => {
                hapticLight();
                setReplying((v) => !v);
              }}
              className="mt-1 text-label-sm text-on-surface-variant hover:text-primary transition-colors inline-flex items-center gap-1"
            >
              <MaterialIcon name="reply" className="text-base" />
              Responder
            </button>
          )}
          {reactionTargetType && (
            <ReactionBar
              targetType={reactionTargetType}
              targetId={comment.id}
              className="mt-1"
            />
          )}
          {replying && (
            <div className="mt-2 flex items-start gap-2">
              <Avatar
                size="sm"
                src={currentUser?.avatar_url}
                alt={currentUser?.name}
                initials={initialsOf(currentUser?.name) || "?"}
                className="w-7! h-7!"
              />
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitReply()}
                  placeholder={`Responde a ${comment.author?.name ?? "este usuario"}...`}
                  className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors pr-10"
                  inputMode="text"
                  autoComplete="off"
                  enterKeyHint="send"
                  autoFocus
                />
                <button
                  onClick={() => {
                    hapticLight();
                    submitReply();
                  }}
                  disabled={!replyText.trim() || sending}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30 transition-opacity"
                  aria-label="Enviar respuesta"
                >
                  <MaterialIcon name="send" className="text-base" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      {replies.length > 0 && (
        <div className="ml-4 md:ml-8 pl-3 md:pl-4 border-l-2 border-outline-variant/20 space-y-3">
          {replies.map((r) => (
            <CommentNode
              key={r.id}
              comment={r}
              currentUser={currentUser}
              onReply={onReply}
              timeAgo={timeAgo}
              depth={depth + 1}
              reactionTargetType={reactionTargetType}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CommentThreadProps {
  comments: ThreadComment[];
  currentUser?: User | null;
  onReply: (parentId: string, body: string) => Promise<void>;
  timeAgo: (dateStr: string) => string;
  reactionTargetType?: ReactionTargetType;
}

/** Recursive threaded comments with inline reply composer.
 *
 * Used by the profile post feed, article ("Cartas al Director") and forum
 * debate views. The parent owns the state updates (appendReply + API call).
 */
export const CommentThread = memo(function CommentThread({
  comments,
  currentUser,
  onReply,
  timeAgo,
  reactionTargetType,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <p className="text-label-sm text-on-surface-variant/70">
        Aun no hay comentarios. Se el primero.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {comments.map((c) => (
        <CommentNode
          key={c.id}
          comment={c}
          currentUser={currentUser}
          onReply={onReply}
          timeAgo={timeAgo}
          reactionTargetType={reactionTargetType}
        />
      ))}
    </div>
  );
});
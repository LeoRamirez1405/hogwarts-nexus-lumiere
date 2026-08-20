"use client";

import { memo, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Avatar, MaterialIcon, ReactionBar, MentionText, MentionInput } from "@/components/ui";
import type { User, ReactionTargetType } from "@/lib/api";
import { toastError } from "@/lib/toastStore";
import { hapticLight } from "@/lib/haptics";
import { buildMembers, mergeUniqueMembers, type MentionMember } from "@/lib/mentions-utils";
import { PostVideo } from "@/components/domain/Profile/PostVideo";
import { mediaSrc } from "@/lib/media";
import { useFullscreenMedia } from "@/components/ui/FullscreenMediaProvider";

export interface ThreadComment {
  id: string;
  user_id: string;
  author?: User;
  body: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  video_duration?: number;
  created_at: string;
  replies?: ThreadComment[];
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export function countComments(list: ThreadComment[]): number {
  return list.reduce((n, c) => n + 1 + countComments(c.replies ?? []), 0);
}

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

export function findCommentNode<T extends ThreadComment>(
  list: T[],
  id: string
): T | null {
  for (const c of list) {
    if (c.id === id) return c;
    if (c.replies?.length) {
      const found = findCommentNode(c.replies as T[], id);
      if (found) return found;
    }
  }
  return null;
}

interface CommentNodeProps {
  comment: ThreadComment;
  currentUser?: User | null;
  onReply: (parentId: string, body: string) => Promise<void>;
  timeAgo: (dateStr: string) => string;
  depth?: number;
  reactionTargetType?: ReactionTargetType;
  members: MentionMember[];
  onRequestReply?: (comment: ThreadComment) => void;
  highlightId?: string | null;
}

function CommentNode({
  comment,
  currentUser,
  onReply,
  timeAgo,
  depth = 0,
  reactionTargetType,
  members,
  onRequestReply,
  highlightId,
}: CommentNodeProps) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const replies = comment.replies ?? [];

  const { open: openFullscreen } = useFullscreenMedia();
  const nodeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (highlightId !== comment.id) return;
    const el = nodeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("comment-flash");
    const t = setTimeout(() => el.classList.remove("comment-flash"), 2600);
    return () => {
      clearTimeout(t);
      el.classList.remove("comment-flash");
    };
  }, [highlightId, comment.id]);

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
          <div
            ref={nodeRef}
            id={`comment-${comment.id}`}
            className="bg-surface-container-low rounded-xl px-3 py-2"
          >
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
            <div className="text-body-md text-on-surface break-words">
              <MentionText text={comment.body} members={members} />
            </div>
            {comment.image_url && (
              <div className="mt-2 rounded-xl overflow-hidden cursor-pointer" onClick={() => openFullscreen({ src: comment.image_url!, type: "image", alt: "Imagen del comentario" })}>
                <Image
                  src={mediaSrc(comment.image_url)}
                  alt=""
                  width={400}
                  height={250}
                  className="w-full h-40 object-cover rounded-xl transition-transform hover:scale-[1.02]"
                  unoptimized
                />
              </div>
            )}
            {comment.video_url && (
              <PostVideo
                src={comment.video_url}
                poster={comment.video_poster_url}
                duration={comment.video_duration}
                className="mt-2"
                onOpenFullscreen={() => openFullscreen({ src: comment.video_url!, type: "video", poster: comment.video_poster_url, alt: "Video del comentario" })}
              />
            )}
          </div>
          {currentUser && (
            <button
              onClick={() => {
                hapticLight();
                if (onRequestReply) {
                  onRequestReply(comment);
                } else {
                  setReplying((v) => !v);
                }
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
          {!onRequestReply && replying && (
            <div className="mt-2 flex items-start gap-2">
              <Avatar
                size="sm"
                src={currentUser?.avatar_url}
                alt={currentUser?.name}
                initials={initialsOf(currentUser?.name) || "?"}
                className="w-7! h-7!"
              />
              <div className="flex-1 relative">
                <MentionInput
                  value={replyText}
                  onChange={setReplyText}
                  placeholder={`Responde a ${comment.author?.name ?? "este usuario"}...`}
                  minHeight={40}
                  maxHeight={120}
                  disabled={sending}
                  onSubmit={submitReply}
                  autoFocus
                />
                <button
                  onClick={() => {
                    hapticLight();
                    submitReply();
                  }}
                  disabled={!replyText.trim() || sending}
                  className="absolute right-1.5 bottom-1.5 w-7 h-7 inline-flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30 transition-opacity"
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
              members={members}
              onRequestReply={onRequestReply}
              highlightId={highlightId}
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
  additionalMembers?: MentionMember[];
  onRequestReply?: (comment: ThreadComment) => void;
  highlightId?: string | null;
}

export const CommentThread = memo(function CommentThread({
  comments,
  currentUser,
  onReply,
  timeAgo,
  reactionTargetType,
  additionalMembers = [],
  onRequestReply,
  highlightId,
}: CommentThreadProps) {
  const members = mergeUniqueMembers(buildMembers(null, comments), additionalMembers);
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
          members={members}
          onRequestReply={onRequestReply}
          highlightId={highlightId}
        />
      ))}
    </div>
  );
});
"use client";

import { memo, useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { api, PostComment, User } from "@/lib/api";
import { MentionInput } from "@/components/ui";
import { toastError } from "@/lib/toastStore";
import {
  CommentThread,
  countComments,
  appendReply,
  findCommentNode,
  type ThreadComment,
} from "@/components/domain/comments/CommentThread";
import { CommentComposer } from "@/components/domain/comments/CommentComposer";
import { useImageUpload } from "@/hooks/useFileUpload";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { useHapticLight, useHapticSelection } from "@/hooks/useHapticFeedback";
import {
  extractMentions,
  fetchMentionedUsers,
  mergeUniqueMembers,
  resolveCommentMentions,
  type MentionMember,
} from "@/lib/mentions-utils";
import { timeAgo } from "@/lib/timeAgo";
import { useVisualViewport } from "@/hooks/useVisualViewport";

interface CommentSectionProps {
  postId: string;
  currentUser?: User;
  onLoadedCount?: (count: number) => void;
  additionalMembers?: MentionMember[];
}

/** Expandible comment thread + fixed chat-style composer for a single post.
 * Loads comments on mount (it only mounts once the user expands the section).
 * The composer is portaled so the GlassCard hover transform can't break its
 * fixed positioning. */
export const CommentSection = memo(function CommentSection({
  postId,
  currentUser,
  onLoadedCount,
  additionalMembers = [],
}: CommentSectionProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    authorName: string;
    preview: string;
  } | null>(null);
  const [localMentionedUsers, setLocalMentionedUsers] = useState<MentionMember[]>([]);
  const [imageUrl, setImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const hapticLight = useHapticLight();
  const hapticSelection = useHapticSelection();
  const { isKeyboardOpen, keyboardHeight } = useVisualViewport();

  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => {
      setImageUrl(result.url);
      video.clear();
    },
  });

  const video = useVideoUpload({
    onReady: () => {
      setImageUrl("");
    },
  });

  useEffect(() => {
    if (video.error) {
      console.error(video.error);
    }
  }, [video.error]);

  useEffect(() => {
    let cancelled = false;
    api
      .getComments(postId)
      .then(async (data) => {
        if (cancelled) return;
        setComments(data);
        onLoadedCount?.(countComments(data));

        const commentMentions = await resolveCommentMentions(data);
        if (!cancelled && commentMentions.length > 0) {
          setLocalMentionedUsers(commentMentions);
        }
      })
      .catch((e) => {
        if (!cancelled) toastError("No se pudieron cargar los comentarios", e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [postId, onLoadedCount]);

  const handleComment = useCallback(async (input: {
    body?: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    video_duration?: number;
  }) => {
    const { body, image_url, video_url, video_poster_url, video_duration } = input;
    if ((!body || !body.trim()) && !image_url && !video_url) return;
    if (!currentUser || sending) return;
    hapticLight();
    setSending(true);
    try {
      const parentExists = !!replyTarget && !!findCommentNode(comments, replyTarget.parentId);
      const created = parentExists
        ? await api.addComment(postId, body ?? "", replyTarget!.parentId, image_url, video_url, video_poster_url, video_duration)
        : await api.addComment(postId, body ?? "", undefined, image_url, video_url, video_poster_url, video_duration);
      setComments((prev) =>
        parentExists ? appendReply(prev, replyTarget!.parentId, created) : [created, ...prev],
      );
      onLoadedCount?.(countComments((replyTarget ? appendReply(comments, replyTarget.parentId, created) : [created, ...comments]) as PostComment[]));

      const newUsers = await fetchMentionedUsers(extractMentions(body ?? ""));
      if (newUsers.length > 0) {
        setLocalMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
      }
    } catch (e) {
      toastError("No se pudo enviar el comentario", e);
    } finally {
      setReplyTarget(null);
      setSending(false);
    }
  }, [comments, currentUser, replyTarget, sending]);

  const requestReply = (comment: ThreadComment) => {
    hapticSelection();
    setReplyTarget({
      parentId: comment.id,
      authorName: comment.author?.name ?? "Usuario",
      preview: comment.body.slice(0, 80),
    });
    setTimeout(() => composerInputRef.current?.focus(), 0);
  };

  const cancelReply = () => setReplyTarget(null);

  return (
    <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
      {loading && (
        <p className="text-label-sm text-on-surface-variant">
          Cargando comentarios...
        </p>
      )}
      {!loading && comments.length === 0 && (
        <p className="text-label-sm text-on-surface-variant/70">
          Aun no hay comentarios. Se el primero.
        </p>
      )}
      {!loading && comments.length > 0 && (
        <CommentThread
          comments={comments}
          currentUser={currentUser}
          onReply={async () => {}}
          timeAgo={timeAgo}
          reactionTargetType="post_comment"
          additionalMembers={mergeUniqueMembers(additionalMembers, localMentionedUsers)}
          onRequestReply={requestReply}
        />
      )}

      {/* Spacer so the fixed composer bar never covers the last comment */}
      <div className="h-20" aria-hidden="true" />

      {/* Composer bar (estilo chat) — fija, sobre el BottomNav en el feed */}
      {createPortal(
        currentUser ? (
          <div
            className="fixed left-0 right-0 lg:left-72 z-30 bg-surface/95 backdrop-blur-md px-4 md:px-10 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
            style={{ bottom: isKeyboardOpen ? `${keyboardHeight}px` : "var(--bottomnav-h)" }}
          >
            <div className="max-w-3xl mx-auto">
              <CommentComposer
                placeholder={replyTarget ? "Escribe tu respuesta..." : "Escribe un comentario..."}
                replyTarget={replyTarget}
                onCancelReply={cancelReply}
                onSubmit={handleComment}
                posting={sending}
                composerInputRef={composerInputRef}
              />
            </div>
          </div>
        ) : (
          <p className="text-center text-body-md text-on-surface-variant py-2">
            Inicia sesión para comentar
          </p>
        ),
        document.body
      )}
    </div>
  );
});
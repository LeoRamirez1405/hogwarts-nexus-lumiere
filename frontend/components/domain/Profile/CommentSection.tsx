"use client";

import { memo, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { api, PostComment, User } from "@/lib/api";
import { MaterialIcon, MentionInput } from "@/components/ui";
import { toastError } from "@/lib/toastStore";
import {
  CommentThread,
  countComments,
  appendReply,
  findCommentNode,
  type ThreadComment,
} from "@/components/domain/comments/CommentThread";
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

const EMOJIS = [
  "😀","😂","😍","🥳","😎","🤩","💀","👻","🔥","✨",
  "❤️","💎","⚡","🌟","🎉","🎊","🦋","🐱","🦉","🏰",
  "🪄","📜","🧪","⚗️","🔮","🗝️","🧣","📚","🍲","🧙",
];

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
  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    authorName: string;
    preview: string;
  } | null>(null);
  const [localMentionedUsers, setLocalMentionedUsers] = useState<MentionMember[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);
  const hapticLight = useHapticLight();
  const hapticSelection = useHapticSelection();
  const { isKeyboardOpen, keyboardHeight } = useVisualViewport();

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

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const parentExists = !!replyTarget && !!findCommentNode(comments, replyTarget.parentId);
      const created = parentExists
        ? await api.addComment(postId, text, replyTarget!.parentId)
        : await api.addComment(postId, text);
      const newComments = parentExists
        ? appendReply(comments, replyTarget!.parentId, created)
        : [...comments, created];
      setComments(newComments);
      onLoadedCount?.(countComments(newComments));
      setCommentText("");
      void (async () => {
        const newUsers = await fetchMentionedUsers(extractMentions(text));
        if (newUsers.length > 0) {
          setLocalMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
        }
      })();
    } catch (e) {
      toastError("No se pudo enviar el comentario", e);
    } finally {
      setReplyTarget(null);
      setSending(false);
    }
  };

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

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

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
              {replyTarget && (
                <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                  <MaterialIcon name="reply" className="text-primary text-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-label-sm font-medium text-primary">
                      Respondiendo a {replyTarget.authorName}
                    </p>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      {replyTarget.preview}
                    </p>
                  </div>
                  <button
                    onClick={cancelReply}
                    className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
                    aria-label="Cancelar respuesta"
                  >
                    <MaterialIcon name="close" className="text-lg" />
                  </button>
                </div>
              )}
              <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-3 md:px-4 py-2">
                <button
                  onClick={() => { hapticLight(); setShowEmojiPicker(!showEmojiPicker); }}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary/10 text-primary transition-colors"
                  aria-label="Insertar emoji"
                >
                  <MaterialIcon name="mood" className="text-xl" />
                </button>
                <div className="relative flex-1">
                  <MentionInput
                    ref={composerInputRef}
                    value={commentText}
                    onChange={setCommentText}
                    placeholder={replyTarget ? "Escribe tu respuesta..." : "Escribe un comentario..."}
                    minHeight={40}
                    maxHeight={120}
                    disabled={sending}
                    onSubmit={handleComment}
                    rows={1}
                    textareaClassName="block w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50 resize-none min-h-[2.5rem] max-h-[8rem] leading-6 py-2"
                  />
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl p-3 grid grid-cols-5 gap-1 z-20 w-64">
                      {EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => { hapticSelection(); insertEmoji(e); }}
                          className="p-1.5 rounded-lg hover:bg-surface-container-high text-lg transition-colors"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => { hapticLight(); handleComment(); }}
                  disabled={!commentText.trim() || sending}
                  className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Enviar comentario"
                >
                  <MaterialIcon name="send" className="text-lg" />
                </button>
              </div>
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
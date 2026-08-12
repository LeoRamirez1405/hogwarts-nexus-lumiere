"use client";

import { memo, useEffect, useState } from "react";
import { api, PostComment, User } from "@/lib/api";
import { Avatar, MaterialIcon } from "@/components/ui";
import { toastError } from "@/lib/toastStore";
import {
  CommentThread,
  countComments,
  appendReply,
} from "@/components/domain/comments/CommentThread";
import { useHapticLight, useHapticSelection } from "@/hooks/useHapticFeedback";

const EMOJIS = [
  "😀","😂","😍","🥳","😎","🤩","💀","👻","🔥","✨",
  "❤️","💎","⚡","🌟","🎉","🎊","🦋","🐱","🦉","🏰",
  "🪄","📜","🧪","⚗️","🔮","🗝️","🧣","📚","🍲","🪄",
];

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

interface CommentSectionProps {
  postId: string;
  currentUser?: User;
  onLoadedCount?: (count: number) => void;
}

/** Expandible comment thread + composer for a single post. Loads comments on
 * mount (it only mounts once the user expands the section). */
export const CommentSection = memo(function CommentSection({
  postId,
  currentUser,
  onLoadedCount,
}: CommentSectionProps) {
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const hapticLight = useHapticLight();
  const hapticSelection = useHapticSelection();

  useEffect(() => {
    let cancelled = false;
    api
      .getComments(postId)
      .then((data) => {
        if (cancelled) return;
        setComments(data);
        onLoadedCount?.(countComments(data));
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
      const created = await api.addComment(postId, text);
      setComments((prev) => [...prev, created]);
      onLoadedCount?.(countComments([...comments, created]));
      setCommentText("");
    } catch (e) {
      toastError("No se pudo enviar el comentario", e);
    } finally {
      setSending(false);
    }
  };

  const handleReply = async (parentId: string, text: string) => {
    const created = await api.addComment(postId, text, parentId);
    setComments((prev) => appendReply(prev, parentId, created));
    onLoadedCount?.(countComments(comments) + 1);
  };

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
          onReply={handleReply}
          timeAgo={timeAgo}
          reactionTargetType="post_comment"
        />
      )}
      <div className="flex items-start gap-2 relative">
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
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleComment()}
            placeholder="Escribe un comentario..."
            className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors pr-10"
            inputMode="text"
            autoComplete="off"
            enterKeyHint="send"
          />
          <button
            onClick={() => { hapticLight(); setShowEmojiPicker(!showEmojiPicker); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            aria-label="Insertar emoji"
          >
            <MaterialIcon name="mood" className="text-lg" />
          </button>
          {showEmojiPicker && (
            <div className="absolute bottom-full right-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl p-3 grid grid-cols-5 gap-1 z-20 w-64">
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
          className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30 transition-opacity"
          aria-label="Enviar comentario"
        >
          <MaterialIcon name="send" className="text-lg" />
        </button>
      </div>
    </div>
  );
});

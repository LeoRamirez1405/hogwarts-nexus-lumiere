"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { api, Post, PostComment, User } from "@/lib/api";
import { GlassCard, Avatar, MaterialIcon } from "@/components/ui";

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onShare: (post: Post) => void;
  currentUser?: User;
}

const EMOJIS = [
  "😀","😂","😍","🥳","😎","🤩","💀","👻","🔥","✨",
  "❤️","💎","⚡","🌟","🎉","🎊","🦋","🐱","🦉","🏰",
  "🪄","📜","🧪","⚗️","🔮","🗝️","🧣","📚","🍲","🪄",
];

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export function PostCard({
  post,
  onLike,
  onRepost,
  onShare,
  currentUser,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const displayedCommentCount = commentsLoaded
    ? comments.length
    : post.comments_count ?? 0;

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      setLoadingComments(true);
      try {
        const data = await api.getComments(post.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch {}
      setLoadingComments(false);
    }
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const created = await api.addComment(post.id, text);
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch {}
    setSending(false);
  };

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <GlassCard className="p-6 relative">
      {post.is_repost && post.reposted_by && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-outline-variant/10 text-label-sm text-success">
          <MaterialIcon name="repeat" className="text-base text-success" />
          <span>
            {post.reposted_by.id === currentUser?.id
              ? "Reposteaste"
              : `${post.reposted_by.name} reposteó`}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${post.author_id}`}>
          <Avatar
            src={post.author?.avatar_url}
            alt={post.author?.name}
            size="sm"
            initials={post.author?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")}
          />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author_id}`}
            className="text-body-md font-semibold text-on-surface hover:text-primary transition-colors"
          >
            {post.author?.name ?? "Usuario"}
          </Link>
          <p className="text-label-sm text-on-surface-variant">
            {formatRelative(post.created_at)}
          </p>
        </div>
      </div>
      <p className="text-body-md text-on-surface mb-4 whitespace-pre-wrap">
        {post.body}
      </p>
      {post.image_url && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <Image
            src={post.image_url}
            alt="Post"
            width={600}
            height={400}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-6 pt-3 border-t border-outline-variant/20">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-2 text-label-sm transition-colors ${
            post.liked_by_me
              ? "text-error"
              : "text-on-surface-variant hover:text-error"
          }`}
        >
          <MaterialIcon
            name={post.liked_by_me ? "favorite" : "favorite_border"}
            className="text-lg"
            filled={!!post.liked_by_me}
          />
          {post.likes_count ?? 0}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon
            name={showComments ? "chat_bubble" : "chat_bubble_outline"}
            className="text-lg"
            filled={showComments}
          />
          {displayedCommentCount > 0 ? displayedCommentCount : "Comentar"}
        </button>
        <button
          onClick={() => onRepost(post.id)}
          className={`flex items-center gap-2 text-label-sm transition-colors ${
            post.reposted_by_me
              ? "text-success"
              : "text-on-surface-variant hover:text-success"
          }`}
          title={post.reposted_by_me ? "Quitar repost" : "Repostear"}
        >
          <MaterialIcon name="repeat" className="text-lg" filled={!!post.reposted_by_me} />
          {post.reposts_count ?? 0}
        </button>
        <button
          onClick={() => onShare(post)}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-secondary transition-colors"
          title="Compartir a un chat o grupo"
        >
          <MaterialIcon name="share" className="text-lg" />
          Compartir
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
          {loadingComments && (
            <p className="text-label-sm text-on-surface-variant">
              Cargando comentarios...
            </p>
          )}
          {!loadingComments && comments.length === 0 && (
            <p className="text-label-sm text-on-surface-variant/70">
              Aun no hay comentarios. Se el primero.
            </p>
          )}
          {comments.map((c) => (
            <Link
              key={c.id}
              href={`/profile/${c.user_id}`}
              className="flex items-start gap-2 group"
            >
              <Avatar
                size="sm"
                src={c.author?.avatar_url}
                alt={c.author?.name}
                initials={initialsOf(c.author?.name)}
                className="w-7! h-7!"
              />
              <div className="flex-1 bg-surface-container-low rounded-xl px-3 py-2">
                <p className="text-label-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {c.author?.name ?? "Usuario"}
                </p>
                <p className="text-body-md text-on-surface">{c.body}</p>
              </div>
            </Link>
          ))}
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
              />
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="mood" className="text-lg" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl p-3 grid grid-cols-5 gap-1 z-20 w-64">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => insertEmoji(e)}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high text-lg transition-colors"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || sending}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30 transition-opacity"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}
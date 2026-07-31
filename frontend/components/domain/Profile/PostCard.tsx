"use client";

import { memo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Post, User } from "@/lib/api";
import { mediaSrc } from "@/lib/media";
import { GlassCard, Avatar, MaterialIcon } from "@/components/ui";
import { CommentSection } from "./CommentSection";
import { EditPostModal } from "./EditPostModal";
import { DeletePostModal } from "./DeletePostModal";

interface PostCardProps {
  post: Post;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onShare: (post: Post) => void;
  onEdit?: (id: string, updated: Post) => void;
  onDelete?: (id: string) => void;
  currentUser?: User;
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
  const diff = Date.now() - d.getTime();
  const diffMins = Math.floor(diff / 60000);
  if (diffMins <= 0) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatEditedLabel(dateStr: string): string {
  const d = new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
  const diff = Date.now() - d.getTime();
  const diffMins = Math.floor(diff / 60000);
  if (diffMins <= 0) return "editado ahora";
  if (diffMins < 60) return `editado hace ${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `editado hace ${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `editado hace ${diffDays}d`;
  return `editado el ${d.toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`;
}

function PostCardComponent({
  post,
  onLike,
  onRepost,
  onShare,
  onEdit,
  onDelete,
  currentUser,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments_count ?? 0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const isAuthor = currentUser?.id === post.author_id;

  return (
    <>
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
              {post.edited_at && (
                <span className="ml-1 text-on-surface-variant/70 italic">
                  · {formatEditedLabel(post.edited_at)}
                </span>
              )}
            </p>
          </div>
          {isAuthor && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowEditModal(true)}
                title="Editar publicación"
                className="w-10 h-10 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
              >
                <MaterialIcon name="edit" className="text-lg" />
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                title="Eliminar publicación"
                className="w-10 h-10 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
              >
                <MaterialIcon name="delete" className="text-lg" />
              </button>
            </div>
          )}
        </div>
        <p className="text-body-md text-on-surface mb-4 whitespace-pre-wrap">
          {post.body}
        </p>
        {post.image_url && (
          <div className="mb-4 rounded-xl overflow-hidden">
            <Image
              src={mediaSrc(post.image_url)}
              alt="Post"
              width={600}
              height={400}
              className="w-full h-auto object-cover"
              unoptimized
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
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
          >
            <MaterialIcon
              name={showComments ? "chat_bubble" : "chat_bubble_outline"}
              className="text-lg"
              filled={showComments}
            />
            {commentCount > 0 ? commentCount : "Comentar"}
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
          <CommentSection
            postId={post.id}
            currentUser={currentUser}
            onLoadedCount={setCommentCount}
          />
        )}
      </GlassCard>

      {showEditModal && (
        <EditPostModal
          post={post}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => onEdit?.(post.id, updated)}
        />
      )}

      {showDeleteModal && (
        <DeletePostModal
          post={post}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={(id) => onDelete?.(id)}
        />
      )}
    </>
  );
}

/** Memoized so typing in the post composer or toggling comments on one card
 * doesn't re-render the whole feed. */
export const PostCard = memo(PostCardComponent);

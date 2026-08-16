"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, Post, PostComment } from "@/lib/api";
import { postsApi } from "@/lib/api/posts";
import {
  GlassCard,
  Badge,
  Button,
  Avatar,
  MaterialIcon,
  MentionInput,
  MentionText,
} from "@/components/ui";
import {
  CommentThread,
  countComments,
  appendReply,
} from "@/components/domain/comments/CommentThread";
import { useAuthStore } from "@/lib/authStore";
import { toastError } from "@/lib/toastStore";
import { isStoredUpload } from "@/lib/media";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { timeAgo } from "@/lib/timeAgo";
import {
  buildMembers,
  extractMentions,
  fetchMentionedUsers,
  mergeUniqueMembers,
  resolveCommentMentions,
  type MentionMember,
} from "@/lib/mentions-utils";

function isLocalUpload(src?: string): boolean {
  return isStoredUpload(src);
}

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionMember[]>([]);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const found = await api.getPost(params.id);
        if (cancelled) return;
        setPost(found);

        // Resolve users mentioned in the post body
        const bodyMentions = await fetchMentionedUsers(
          extractMentions(found.body ?? ""),
        );

        try {
          const cs = await postsApi.getComments(found.id);
          if (cancelled) return;
          setComments(cs);

          // Resolve users mentioned in comments
          const commentMentions = await resolveCommentMentions(cs);
          setMentionedUsers(mergeUniqueMembers(bodyMentions, commentMentions));
        } catch (e) {
          if (!cancelled)
            toastError("No se pudieron cargar los comentarios", e);
        }
      } catch (e) {
        if (!cancelled) {
          toastError("No se pudo abrir la publicación", e);
          router.push("/profile");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const handleLike = async () => {
    if (!authUser || liking || !post) return;
    hapticSelection();
    setLiking(true);
    try {
      const updated = await postsApi.likePost(post.id);
      setPost(updated);
    } catch (e) {
      toastError("No se pudo dar like", e);
    } finally {
      setLiking(false);
    }
  };

  const handleRepost = async () => {
    if (!authUser || reposting || !post) return;
    hapticSelection();
    setReposting(true);
    try {
      const updated = await postsApi.repostPost(post.id);
      setPost(updated);
    } catch (e) {
      toastError("No se pudo compartir", e);
    } finally {
      setReposting(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !authUser || !post || posting) return;
    hapticLight();
    setPosting(true);
    try {
      const created = await postsApi.addComment(post.id, newComment.trim());
      setComments((prev) => [created, ...prev]);
      setNewComment("");

      const newUsers = await fetchMentionedUsers(
        extractMentions(newComment.trim()),
      );
      if (newUsers.length > 0) {
        setMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
      }
    } catch (e) {
      toastError("No se pudo enviar tu comentario", e);
    } finally {
      setPosting(false);
    }
  };

  const handleReply = async (parentId: string, text: string) => {
    if (!post) throw new Error("Publicación no cargada");
    const created = await postsApi.addComment(post.id, text, parentId);
    setComments((prev) => appendReply(prev, parentId, created));

    const newUsers = await fetchMentionedUsers(extractMentions(text));
    if (newUsers.length > 0) {
      setMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
    }
  };

  if (loading || !post) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <MaterialIcon
          name="progress_activity"
          className="text-5xl text-outline-variant animate-spin mb-3"
        />
        <p className="text-on-surface-variant text-body-md">
          Abriendo publicación...
        </p>
      </div>
    );
  }

  return (
    <div className="pb-16 space-y-8">
      {/* Back link */}
      <button
        onClick={() => router.push("/profile")}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-xl" />
        <span className="text-body-md">Volver al perfil</span>
      </button>

      {/* Post header */}
      <article className="max-w-3xl mx-auto">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Badge variant="tag" color="secondary">
            Publicación
          </Badge>
          {post.is_repost && (
            <Badge variant="rarity" color="secondary">
              Repost
            </Badge>
          )}
        </div>

        {post.author && (
          <Link
            href={`/profile/${post.author.id}`}
            className="flex items-center justify-center gap-3 mb-8 hover:opacity-80 transition-opacity"
          >
            <Avatar
              src={post.author.avatar_url}
              alt={post.author.name}
              size="sm"
              initials={post.author.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            />
            <div className="text-left">
              <p className="text-body-md font-semibold text-on-surface hover:text-primary transition-colors">
                {post.author.name}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                {post.is_repost && post.reposted_by
                  ? `Reposteado por ${post.reposted_by.name} · ${timeAgo(post.reposted_at!)}`
                  : `Publicado · ${timeAgo(post.created_at)}`}
              </p>
            </div>
          </Link>
        )}

        {post.image_url && (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-8">
            <Image
              src={post.image_url}
              alt="Imagen de la publicación"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              unoptimized={isLocalUpload(post.image_url)}
            />
          </div>
        )}

        <div className="prose prose-lg max-w-none">
          <MentionText
            text={post.body}
            members={
              post
                ? mergeUniqueMembers(
                    buildMembers(post, comments),
                    mentionedUsers,
                  )
                : mentionedUsers
            }
          />
        </div>

        {/* Post actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-outline-variant/20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                hapticSelection();
                if (typeof navigator !== "undefined" && navigator.share) {
                  navigator
                    .share({
                      title: "Hogwarts Nexus",
                      text: `Lee esta publicación en Hogwarts Nexus`,
                      url: window.location.href,
                    })
                    .catch(() => {
                      /* user cancelled — do nothing */
                    });
                } else {
                  navigator.clipboard?.writeText(window.location.href);
                }
              }}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface-container-high hover:bg-primary-container text-on-surface-variant hover:text-on-primary-container transition-colors"
              aria-label="Compartir"
              title="Compartir"
            >
              <MaterialIcon name="share" className="text-xl" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={post.liked_by_me ? "primary" : "ghost"}
              size="sm"
              icon="favorite"
              onClick={handleLike}
              disabled={liking || !authUser}
            >
              {post.likes_count ?? 0}
            </Button>
            <Button
              variant={post.reposted_by_me ? "primary" : "ghost"}
              size="sm"
              icon="repeat"
              onClick={handleRepost}
              disabled={reposting || !authUser}
            >
              {post.reposts_count ?? 0}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="comment"
              disabled={!authUser}
            >
              {post.comments_count ?? 0}
            </Button>
          </div>
        </div>
      </article>

      {/* Comments */}
      <section className="max-w-3xl mx-auto">
        <h2 className="font-display text-headline-lg text-on-surface mb-4 flex items-center gap-2">
          <MaterialIcon name="comment" className="text-secondary" filled />
          Comentarios ({countComments(comments)})
        </h2>

        {authUser && (
          <GlassCard className="p-4 mb-4">
            <div className="flex gap-3">
              <Avatar
                src={authUser.avatar_url}
                alt={authUser.name}
                size="sm"
                initials={authUser.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              />
              <div className="flex-1">
                <MentionInput
                  value={newComment}
                  onChange={setNewComment}
                  placeholder="Escribe un comentario..."
                  minHeight={80}
                  maxHeight={200}
                  disabled={posting}
                />
                <div className="flex justify-end mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="send"
                    onClick={handleSubmitComment}
                    disabled={posting || !newComment.trim()}
                  >
                    {posting ? "Enviando..." : "Enviar"}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        )}

        <CommentThread
          comments={comments}
          currentUser={authUser}
          onReply={handleReply}
          timeAgo={timeAgo}
          reactionTargetType="post_comment"
          additionalMembers={mentionedUsers}
        />
      </section>
    </div>
  );
}

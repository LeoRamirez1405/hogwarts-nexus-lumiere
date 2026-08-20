"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { api, Post, PostComment } from "@/lib/api";
import { postsApi } from "@/lib/api/posts";
import {
  Badge,
  Button,
  Avatar,
  MaterialIcon,
  MentionText,
} from "@/components/ui";
import {
  CommentThread,
  countComments,
  appendReply,
  findCommentNode,
  type ThreadComment,
} from "@/components/domain/comments/CommentThread";
import { CommentComposer } from "@/components/domain/comments/CommentComposer";
import { EditPostModal } from "@/components/domain/Profile/EditPostModal";
import { DeletePostModal } from "@/components/domain/Profile/DeletePostModal";
import { PostVideo } from "@/components/domain/Profile/PostVideo";
import { useAuthStore } from "@/lib/authStore";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { isStoredUpload } from "@/lib/media";
import { hapticLight, hapticSelection } from "@/lib/haptics";
import { timeAgo } from "@/lib/timeAgo";
import { useFullscreenMedia } from "@/components/ui/FullscreenMediaViewer";
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
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    authorName: string;
    preview: string;
  } | null>(null);
  const [posting, setPosting] = useState(false);
  const [liking, setLiking] = useState(false);
  const [reposting, setReposting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionMember[]>([]);

  const { open: openFullscreen, FullscreenViewer } = useFullscreenMedia();

  const composerInputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmitComment = async (input: {
    body?: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    video_duration?: number;
  }) => {
    const { body, image_url, video_url, video_poster_url, video_duration } = input;
    if ((!body || !body.trim()) && !image_url && !video_url) return;
    if (!authUser || !post || posting) return;
    hapticLight();
    setPosting(true);
    try {
      const parentExists = !!replyTarget && !!findCommentNode(comments, replyTarget.parentId);
      const created = parentExists
        ? await postsApi.addComment(post.id, body ?? "", replyTarget!.parentId, image_url, video_url, video_poster_url, video_duration)
        : await postsApi.addComment(post.id, body ?? "", undefined, image_url, video_url, video_poster_url, video_duration);
      setComments((prev) =>
        parentExists ? appendReply(prev, replyTarget!.parentId, created) : [created, ...prev],
      );
      setHighlightedId(created.id);
      setPost((p) => (p ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p));

      const newUsers = await fetchMentionedUsers(extractMentions(body ?? ""));
      if (newUsers.length > 0) {
        setMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
      }
    } catch (e) {
      toastError("No se pudo enviar tu comentario", e);
    } finally {
      setReplyTarget(null);
      setPosting(false);
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
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0 space-y-8">
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

        {post.video_url ? (
          <div className="relative mb-8">
            <PostVideo
              src={post.video_url}
              poster={post.video_poster_url}
              duration={post.video_duration ?? undefined}
              onOpenFullscreen={() => openFullscreen({ src: post.video_url!, type: "video", poster: post.video_poster_url, alt: "Video de la publicación" })}
            />
          </div>
        ) : post.image_url ? (
          <div className="relative h-72 md:h-96 rounded-2xl overflow-hidden mb-8 cursor-pointer" onClick={() => openFullscreen({ src: post.image_url!, type: "image", alt: "Imagen de la publicación" })}>
            <Image
              src={post.image_url}
              alt="Imagen de la publicación"
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover transition-transform hover:scale-[1.02]"
              unoptimized={isLocalUpload(post.image_url)}
            />
            <div className="absolute bottom-4 right-4 p-2 bg-black/60 text-white rounded-full">
              <MaterialIcon name="zoom_in" className="text-base" />
            </div>
          </div>
        ) : null}
        <FullscreenViewer />

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
            {authUser?.id === post.author_id && (
              <>
                <button
                  onClick={() => {
                    hapticLight();
                    setShowEdit(true);
                  }}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface-container-high hover:bg-primary-container text-on-surface-variant hover:text-on-primary-container transition-colors"
                  aria-label="Editar publicación"
                  title="Editar publicación"
                >
                  <MaterialIcon name="edit" className="text-xl" />
                </button>
                <button
                  onClick={() => {
                    hapticLight();
                    setShowDelete(true);
                  }}
                  className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-surface-container-high hover:bg-error/10 text-on-surface-variant hover:text-error transition-colors"
                  aria-label="Eliminar publicación"
                  title="Eliminar publicación"
                >
                  <MaterialIcon name="delete" className="text-xl" />
                </button>
              </>
            )}
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

        <CommentThread
          comments={comments}
          currentUser={authUser}
          onReply={async () => {}}
          timeAgo={timeAgo}
          reactionTargetType="post_comment"
          additionalMembers={mentionedUsers}
          onRequestReply={requestReply}
          highlightId={highlightedId}
        />
      </section>
      </div>

      {/* Composer bar (estilo chat) — en flujo, sticky al fondo del main */}
      {authUser ? (
        <div className="sticky bottom-0 shrink-0 z-30 bg-surface/95 backdrop-blur-md -mx-4 md:-mx-10 -mb-6 md:-mb-8 px-4 md:px-10 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-3xl mx-auto">
            <CommentComposer
              placeholder={replyTarget ? "Escribe tu respuesta..." : "Escribe un comentario..."}
              replyTarget={replyTarget}
              onCancelReply={cancelReply}
              onSubmit={handleSubmitComment}
              posting={posting}
              composerInputRef={composerInputRef}
            />
          </div>
        </div>
      ) : (
        <p className="text-center text-body-md text-on-surface-variant py-2">
          Inicia sesión para comentar
        </p>
      )}

      {showEdit && (
        <EditPostModal
          post={post}
          onClose={() => setShowEdit(false)}
          onSaved={(updated) => {
            setPost(updated);
            setShowEdit(false);
          }}
        />
      )}

      {showDelete && (
        <DeletePostModal
          post={post}
          onClose={() => setShowDelete(false)}
          onDeleted={() => {
            toastSuccess("Publicación eliminada");
            router.push("/profile");
          }}
        />
      )}
    </div>
  );
}

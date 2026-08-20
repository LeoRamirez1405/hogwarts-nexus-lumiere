"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ForumThread, ForumComment } from "@/lib/api";
import { GlassCard, Badge, Button, Avatar, MaterialIcon, ReactionBar, MentionText } from "@/components/ui";
import {
  CommentThread,
  countComments,
  appendReply,
  findCommentNode,
  type ThreadComment,
} from "@/components/domain/comments/CommentThread";
import { CommentComposer } from "@/components/domain/comments/CommentComposer";
import { useAuthStore } from "@/lib/authStore";
import { buildMembers, extractMentions, fetchMentionedUsers, mergeUniqueMembers, resolveCommentMentions, type MentionMember } from "@/lib/mentions-utils";
import { timeAgo } from "@/lib/timeAgo";

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("");
}

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [replyTarget, setReplyTarget] = useState<{
    parentId: string;
    authorName: string;
    preview: string;
  } | null>(null);
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mentionedUsers, setMentionedUsers] = useState<MentionMember[]>([]);
  const composerInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    Promise.all([api.getThread(params.id), api.getThreadComments(params.id)])
      .then(async ([t, cs]) => {
        if (cancelled) return;
        setThread(t);
        setComments(cs);

        // Resolve users mentioned in the thread body
        const bodyMentions = await fetchMentionedUsers(extractMentions(t.body ?? ""));

        // Resolve users mentioned in comments
        const commentMentions = await resolveCommentMentions(cs);
        setMentionedUsers(mergeUniqueMembers(bodyMentions, commentMentions));
      })
      .catch(() => {
        if (!cancelled) router.push("/news");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const handleVote = useCallback(
    async (dir: 1 | -1) => {
      if (!authUser || !thread || busy) return;
      setBusy(true);
      try {
        const updated = await api.voteThread(thread.id, dir);
        setThread(updated);
      } catch (error) {
        console.error('Failed to vote on thread:', error);
      } finally {
        setBusy(false);
      }
    },
    [authUser, thread, busy]
  );

  const handleSubscribe = useCallback(async () => {
    if (!authUser || !thread || busy) return;
    setBusy(true);
    try {
      if (thread.subscribed) {
        await api.unsubscribeThread(thread.id);
      } else {
        await api.subscribeThread(thread.id);
      }
      setThread((t) => (t ? { ...t, subscribed: !t.subscribed } : t));
    } catch (error) {
      console.error('Failed to toggle thread subscription:', error);
    } finally {
      setBusy(false);
    }
  }, [authUser, thread, busy]);

  const handleSubmitComment = async (input: {
    body?: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    video_duration?: number;
  }) => {
    const { body, image_url, video_url, video_poster_url, video_duration } = input;
    if ((!body || !body.trim()) && !image_url && !video_url) return;
    if (!authUser || !thread || posting) return;
    setPosting(true);
    try {
      const parentExists = !!replyTarget && !!findCommentNode(comments, replyTarget.parentId);
      const created = parentExists
        ? await api.createThreadComment(thread.id, body ?? "", replyTarget!.parentId, image_url, video_url, video_poster_url, video_duration)
        : await api.createThreadComment(thread.id, body ?? "", undefined, image_url, video_url, video_poster_url, video_duration);
      setComments((prev) =>
        parentExists ? appendReply(prev, replyTarget!.parentId, created) : [created, ...prev],
      );
      setHighlightedId(created.id);
      setThread((t) =>
        t ? { ...t, comment_count: t.comment_count + 1, subscribed: true } : t
      );

      const newUsers = await fetchMentionedUsers(extractMentions(body ?? ""));
      if (newUsers.length > 0) {
        setMentionedUsers((prev) => mergeUniqueMembers(prev, newUsers));
      }
    } catch (error) {
      console.error('Failed to post comment:', error);
    } finally {
      setReplyTarget(null);
      setPosting(false);
    }
  };

  const requestReply = (comment: ThreadComment) => {
    setReplyTarget({
      parentId: comment.id,
      authorName: comment.author?.name ?? "Usuario",
      preview: comment.body.slice(0, 80),
    });
    setTimeout(() => composerInputRef.current?.focus(), 0);
  };

  const cancelReply = () => setReplyTarget(null);

  if (loading || !thread) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <MaterialIcon name="progress_activity" className="text-5xl text-outline-variant animate-spin mb-3" />
        <p className="text-on-surface-variant text-body-md">Abriendo debate...</p>
      </div>
    );
  }

  const authorName = thread.author?.name ?? "Anónimo";

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 min-h-0 space-y-6 max-w-3xl mx-auto w-full">
      <button
        onClick={() => router.push("/news")}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-xl" />
        <span className="text-body-md">Volver al Foro</span>
      </button>

      {/* Thread */}
      <GlassCard className="p-6">
        <div className="flex gap-4">
          {/* Votes */}
          <div className="flex flex-col items-center gap-1 text-center min-w-[44px]">
            <button
              onClick={() => handleVote(1)}
              disabled={!authUser || busy}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                thread.my_vote === 1
                  ? "bg-secondary-container text-on-secondary-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              aria-label="Votar positivo"
            >
              <MaterialIcon name="expand_less" className="text-2xl" />
            </button>
            <span className="text-title-md font-bold text-on-surface">
              {thread.vote_count}
            </span>
            <button
              onClick={() => handleVote(-1)}
              disabled={!authUser || busy}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                thread.my_vote === -1
                  ? "bg-error-container text-on-error-container"
                  : "text-on-surface-variant hover:bg-surface-container-high"
              }`}
              aria-label="Votar negativo"
            >
              <MaterialIcon name="expand_more" className="text-2xl" />
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="tag">{thread.category}</Badge>
            </div>
            <h1 className="font-display text-headline-md text-on-surface leading-tight mb-3">
              {thread.title}
            </h1>
            <div className="flex items-center gap-2 mb-4">
              <Avatar
                src={thread.author?.avatar_url}
                alt={authorName}
                size="sm"
                initials={initials(authorName)}
              />
              <div>
                <p className="text-label-md font-semibold text-on-surface">{authorName}</p>
                <p className="text-label-sm text-on-surface-variant">{timeAgo(thread.created_at)}</p>
              </div>
            </div>
            <div className="prose max-w-none">
              <MentionText text={thread.body} members={thread ? mergeUniqueMembers(buildMembers(thread, comments), mentionedUsers) : mentionedUsers} />
            </div>
            {authUser && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20 flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={thread.subscribed ? "notifications_off" : "notifications_active"}
                  onClick={handleSubscribe}
                  disabled={busy}
                >
                  {thread.subscribed ? "Suscrito" : "Suscribirse"}
                </Button>
                <ReactionBar targetType="forum_thread" targetId={thread.id} />
              </div>
            )}
            {!authUser && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                <ReactionBar targetType="forum_thread" targetId={thread.id} />
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Comments */}
      <section>
        <h2 className="font-display text-headline-md text-on-surface mb-4 flex items-center gap-2">
          <MaterialIcon name="forum" className="text-secondary" filled />
          Respuestas ({countComments(comments)})
        </h2>

        <div className="space-y-3">
          <CommentThread
            comments={comments}
            currentUser={authUser}
            onReply={async () => {}}
            timeAgo={timeAgo}
            reactionTargetType="forum_comment"
            additionalMembers={mentionedUsers}
            onRequestReply={requestReply}
            highlightId={highlightedId}
          />
          {comments.length === 0 && (
            <GlassCard className="p-8 text-center">
              <MaterialIcon name="chat_bubble_outline" className="text-4xl text-outline-variant mb-2" />
              <p className="text-on-surface-variant text-body-md">
                Aún no hay respuestas. Sé el primero.
              </p>
            </GlassCard>
          )}
        </div>
      </section>
      </div>

      {/* Composer bar (estilo chat) — en flujo, sticky al fondo del main */}
      {authUser ? (
        <div className="sticky bottom-0 shrink-0 z-30 bg-surface/95 backdrop-blur-md -mx-4 md:-mx-10 -mb-6 md:-mb-8 px-4 md:px-10 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <div className="max-w-3xl mx-auto">
            <CommentComposer
              placeholder={replyTarget ? "Escribe tu respuesta..." : "Participa en el debate..."}
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
          Inicia sesión para participar en el debate
        </p>
      )}
    </div>
  );
}

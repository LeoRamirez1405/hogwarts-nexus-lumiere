"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api, ForumThread, ForumComment } from "@/lib/api";
import { GlassCard, Badge, Button, Avatar, MaterialIcon } from "@/components/ui";
import { useAuthStore } from "@/lib/authStore";

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr.endsWith("Z") || dateStr.includes("+") ? dateStr : dateStr + "Z");
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins <= 0) return "ahora mismo";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  const days = Math.floor(hrs / 24);
  return `hace ${days} d`;
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("");
}

export default function ThreadDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuthStore();

  const [thread, setThread] = useState<ForumThread | null>(null);
  const [comments, setComments] = useState<ForumComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    Promise.all([api.getThread(params.id), api.getThreadComments(params.id)])
      .then(([t, cs]) => {
        if (cancelled) return;
        setThread(t);
        setComments(cs);
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
      } catch {
        // ignore
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
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [authUser, thread, busy]);

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !authUser || !thread || posting) return;
    setPosting(true);
    try {
      const created = await api.createThreadComment(thread.id, newComment.trim());
      setComments((prev) => [...prev, created]);
      setNewComment("");
      setThread((t) =>
        t ? { ...t, comment_count: t.comment_count + 1, subscribed: true } : t
      );
    } catch {
      // ignore
    } finally {
      setPosting(false);
    }
  };

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
    <div className="max-w-3xl mx-auto pb-16 space-y-6">
      <button
        onClick={() => router.push("/news")}
        className="inline-flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-xl" />
        <span className="text-body-md">Volver al Foro</span>
      </button>

      {/* Thread */}
      <GlassCard className="p-6 parchment-texture">
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
              {thread.body.split("\n").map((para, i) => (
                <p key={i} className="text-body-md text-on-surface-variant leading-relaxed mb-3">
                  {para}
                </p>
              ))}
            </div>
            {authUser && (
              <div className="mt-4 pt-4 border-t border-outline-variant/20">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={thread.subscribed ? "notifications_off" : "notifications_active"}
                  onClick={handleSubscribe}
                  disabled={busy}
                >
                  {thread.subscribed ? "Suscrito" : "Suscribirse"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Comments */}
      <section>
        <h2 className="font-display text-headline-md text-on-surface mb-4 flex items-center gap-2">
          <MaterialIcon name="forum" className="text-secondary" filled />
          Respuestas ({thread.comment_count})
        </h2>

        {authUser ? (
          <GlassCard className="p-4 mb-4">
            <div className="flex gap-3">
              <Avatar
                src={authUser.avatar_url}
                alt={authUser.name}
                size="sm"
                initials={initials(authUser.name)}
              />
              <div className="flex-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Escribe tu respuesta... (gana 5 zerines)"
                  className="w-full p-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-20 resize-none"
                />
                <div className="flex justify-end mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    icon="send"
                    onClick={handleSubmitComment}
                    disabled={posting || !newComment.trim()}
                  >
                    {posting ? "Enviando..." : "Responder"}
                  </Button>
                </div>
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-4 mb-4 text-center text-on-surface-variant text-body-md">
            Inicia sesión para participar en el debate.
          </GlassCard>
        )}

        <div className="space-y-3">
          {comments.map((c) => {
            const cName = c.author?.name ?? "Anónimo";
            return (
              <GlassCard key={c.id} className="p-4">
                <div className="flex gap-3">
                  <Avatar
                    src={c.author?.avatar_url}
                    alt={cName}
                    size="sm"
                    initials={initials(cName)}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-body-md font-semibold text-on-surface">{cName}</p>
                      <p className="text-label-sm text-on-surface-variant">{timeAgo(c.created_at)}</p>
                    </div>
                    <p className="text-body-md text-on-surface-variant leading-relaxed">{c.body}</p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
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
  );
}

"use client";

import { useRouter } from "next/navigation";
import { MaterialIcon } from "@/components/ui";
import { GlassCard, Badge } from "@/components/ui";

interface Thread {
  id: string;
  title: string;
  body: string;
  category: string;
  voteCount: number;
  userVote: 0 | 1 | -1;
  commentCount: number;
}

interface ForumThreadsProps {
  threads: Thread[];
  votedThread: string | null;
  onVote: (threadId: string, dir: 1 | -1) => void;
}

export function ForumThreads({ threads, votedThread, onVote }: ForumThreadsProps) {
  const router = useRouter();
  const avatarLetters = ["A", "B", "C"];

  return (
    <div className="space-y-3">
      {threads.map((thread) => {
        return (
          <GlassCard
            key={thread.id}
            className="p-5 parchment-texture"
            hover
            onClick={() => router.push(`/news/thread/${thread.id}`)}
          >
            <div className="flex items-center gap-4">
              {/* Vote counter */}
              <div className="flex flex-col items-center gap-1 text-center min-w-[40px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVote(thread.id, 1);
                  }}
                  className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${
                    thread.userVote === 1
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                  aria-label="Votar positivo"
                >
                  <MaterialIcon name="expand_less" className="text-xl" />
                </button>
                <span className="text-body-md font-bold text-on-surface">
                  {thread.voteCount}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onVote(thread.id, -1);
                  }}
                  className={`w-8 h-8 inline-flex items-center justify-center rounded-full transition-colors ${
                    thread.userVote === -1
                      ? "bg-error-container text-on-error-container"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                  aria-label="Votar negativo"
                >
                  <MaterialIcon name="expand_more" className="text-xl" />
                </button>
              </div>

              {/* Thread info */}
              <div className="flex-1 min-w-0 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="tag">{thread.category}</Badge>
                  {votedThread === thread.id && thread.userVote !== 0 && (
                    <Badge variant="count" color="secondary">
                      {thread.userVote === 1 ? "+1" : "-1"}
                    </Badge>
                  )}
                </div>
                <h3 className="text-body-md font-semibold text-on-surface leading-snug">
                  {thread.title}
                </h3>
                <p className="text-label-sm text-on-surface-variant mt-1 line-clamp-1">
                  {thread.body.slice(0, 100)}...
                </p>
              </div>

              {/* Avatar stack & meta */}
              <div className="hidden md:flex items-center gap-4 text-on-surface-variant shrink-0">
                <div className="flex items-center gap-1">
                  <MaterialIcon name="chat_bubble_outline" className="text-lg" />
                  <span className="text-label-sm">{thread.commentCount}</span>
                </div>
                <div className="flex -space-x-2">
                  {[...Array(3)].map((_, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-surface-container-high border-2 border-surface flex items-center justify-center"
                    >
                      <span className="text-[8px] text-on-surface-variant">
                        {avatarLetters[i]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </GlassCard>
        );
      })}

      {threads.length === 0 && (
        <GlassCard className="p-12 text-center">
          <MaterialIcon name="forum" className="text-5xl text-outline-variant mb-3" />
          <p className="text-on-surface-variant text-body-md">
            Aun no hay debates abiertos
          </p>
          <p className="text-on-surface-variant/60 text-label-sm mt-1">
            Se el primero en iniciar una discusion
          </p>
        </GlassCard>
      )}
    </div>
  );
}
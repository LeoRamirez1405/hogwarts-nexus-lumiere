"use client";

import { Post, User } from "@/lib/api";
import { PostCard } from "@/components/domain/Profile";
import { GlassCard, ListFooter, MaterialIcon } from "@/components/ui";

interface PostsFeedProps {
  posts: Post[];
  hasMore: boolean;
  loadingMore: boolean;
  total: number;
  totalCount: number;
  onLoadMore: () => Promise<void>;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  onLike: (postId: string) => Promise<void>;
  onRepost: (postId: string) => Promise<void>;
  onShare: (post: Post) => void;
  onEdit: () => Promise<void>;
  onDelete: (postId: string) => Promise<void>;
  currentUser?: User;
}

export function PostsFeed({
  posts,
  hasMore,
  loadingMore,
  total,
  totalCount,
  onLoadMore,
  sentinelRef,
  onLike,
  onRepost,
  onShare,
  onEdit,
  onDelete,
  currentUser,
}: PostsFeedProps) {
  if (posts.length === 0) {
    return (
      <GlassCard className="p-12 text-center">
        <MaterialIcon name="article" className="text-5xl text-outline-variant mb-3" />
        <p className="text-on-surface-variant text-body-md">Aún no hay publicaciones</p>
      </GlassCard>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {posts.map((post) => (
          <PostCard
            key={`${post.is_repost ? "r" : "p"}-${post.id}`}
            post={post}
            onLike={onLike}
            onRepost={onRepost}
            onShare={onShare}
            onEdit={onEdit}
            onDelete={onDelete}
            currentUser={currentUser}
          />
        ))}
      </div>
      <ListFooter
        hasMore={hasMore}
        loading={loadingMore}
        pageSize={8}
        loaded={total}
        total={totalCount}
        onLoadMore={onLoadMore}
      />
      {/* Sentinel for IntersectionObserver-driven infinite scroll */}
      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
    </>
  );
}

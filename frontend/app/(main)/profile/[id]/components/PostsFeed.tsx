"use client";

import { Post, User } from "@/lib/api";
import { PostCard } from "@/components/domain/Profile";
import { GlassCard, ListFooter, MaterialIcon, VirtualizedList } from "@/components/ui";

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

  const estimatedHeight = 320;

  const renderPostItem = (post: Post, index: number, style: React.CSSProperties) => (
    <div style={style} className="w-full">
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
    </div>
  );

  return (
    <>
      <VirtualizedList
        items={posts}
        itemHeight={estimatedHeight}
        loadingMore={loadingMore}
        loadMoreSentinel={
          <div className="flex items-center justify-center gap-2 py-4 text-on-surface-variant">
            <MaterialIcon name="sync" className="animate-spin text-primary" />
            <span>Cargando más...</span>
          </div>
        }
        sentinelRef={sentinelRef}
        overscanCount={3}
        renderItem={renderPostItem}
      />
      <ListFooter
        hasMore={hasMore}
        loading={loadingMore}
        pageSize={8}
        loaded={total}
        total={totalCount}
        onLoadMore={onLoadMore}
      />
    </>
  );
}

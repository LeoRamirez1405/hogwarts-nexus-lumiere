"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuthStore } from "@/lib/authStore";
import { api, Post } from "@/lib/api";
import {
  ProfileHeader,
  PostCard,
  SharePostModal,
  EditProfileModal,
  StatsCards,
  FriendsGrid,
  AllFriendsModal,
} from "@/components/domain/Profile";
import { MaterialIcon, GlassCard, Avatar, Button, ListFooter } from "@/components/ui";
import ProfileDetails from "./ProfileDetails";
import { useImageUpload } from "@/hooks/useFileUpload";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { toastError, toastSuccess } from "@/lib/toastStore";

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.toLocaleDateString("es-ES", { day: "numeric" });
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const profileId = (params?.id as string) ?? authUser?.id ?? "";

  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postImageUrl, setPostImageUrl] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [showAllFriends, setShowAllFriends] = useState(false);

  /**
   * Local override for the friend request displayed in the header — applied
   * only after the user clicks a friend action.Kept together so we don't
   * scatter 3 small states that always move as one. `status` and `frId` are
   * null when there's no override yet; we then derive from the server data.
   */
  const [frOverride, setFrOverride] = useState<{
    status: "none" | "pending_sent" | "pending_received" | "accepted" | "rejected" | null;
    frId: string | null;
    loading: boolean;
  }>({ status: null, frId: null, loading: false });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => setPostImageUrl(result.url),
  });

  const {
    items: allPosts,
    hasMore: postsHasMore,
    loading: postsLoading,
    loadingMore: postsLoadingMore,
    totalLoaded: postsTotal,
    totalCount: postsTotalCount,
    loadMore: loadMorePosts,
  } = usePaginatedList({
    fetcher: (p) => api.getProfileFeed(profileId, p),
    pageSize: 8,
    enabled: !!profileId,
    queryKey: ["profile-feed", profileId],
  });

  const visiblePosts = allPosts;

  const {
    data: profile,
    refetch: refetchProfile,
    isError: profileError,
  } = useQuery({
    queryKey: ["profile", profileId],
    queryFn: () => api.getUser(profileId),
    enabled: !!profileId,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ["friends", profileId],
    queryFn: () => api.getFriends(profileId),
    enabled: !!profileId,
  });

  const { data: friendRequests = [] } = useQuery({
    queryKey: ["friend-requests"],
    queryFn: () => api.getFriendRequests(),
    enabled: !!authUser && authUser.id !== profileId,
  });

  const isOwn = authUser?.id === profileId;

  useEffect(() => {
    if (profileError) router.push("/dashboard");
  }, [profileError, router]);

  // Infinite scroll: trigger `loadMorePosts` whenever the sentinel
  // element becomes visible at the bottom of the feed. Disables itself
  // while a page is already loading or there are no more pages.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && postsHasMore && !postsLoadingMore) {
          loadMorePosts();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [postsHasMore, postsLoadingMore, loadMorePosts]);

  // Derive friend-request state from the query result during render.
  // Local state (frStatus/currentFrId) only overrides after a user action;
  // "no override yet" is represented by null.
  const existingFr = useMemo(() => {
    if (!authUser || authUser.id === profileId) return null;
    return (
      friendRequests.find(
        (fr) =>
          (fr.sender_id === authUser.id && fr.receiver_id === profileId) ||
          (fr.sender_id === profileId && fr.receiver_id === authUser.id)
      ) ?? null
    );
  }, [friendRequests, authUser, profileId]);

  const derivedFrStatus: "none" | "pending_sent" | "pending_received" | "accepted" | "rejected" =
    !existingFr
      ? "none"
      : existingFr.status === "accepted"
        ? "accepted"
        : existingFr.status === "rejected"
          ? "rejected"
          : existingFr.sender_id === authUser?.id
            ? "pending_sent"
            : "pending_received";

  const effectiveFrStatus = frOverride.status ?? derivedFrStatus;
  const effectiveFrId = frOverride.frId ?? existingFr?.id ?? null;

  const handleLike = useCallback(
    async (postId: string) => {
      // Optimistic update: flip liked_by_me + adjust likes_count in every
      // cached page of the profile feed so the UI reflects the click before
      // the server confirms. Reverted on error.
      const queryKey = ["profile-feed", profileId];
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<{ pages?: { items: Post[] }[] }>(queryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    liked_by_me: !p.liked_by_me,
                    likes_count: (p.likes_count ?? 0) + (p.liked_by_me ? -1 : 1),
                  }
                : p
            ),
          })),
        };
      });
      try {
        await api.likePost(postId);
        queryClient.invalidateQueries({ queryKey });
      } catch (e) {
        // Revert optimistic update and inform.
        queryClient.setQueryData(queryKey, previous);
        toastError("No se pudo dar like", e);
      }
    },
    [profileId]
  );

  const handleRepost = useCallback(
    async (postId: string) => {
      const queryKey = ["profile-feed", profileId];
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData<{ pages?: { items: Post[] }[] }>(queryKey, (old) => {
        if (!old?.pages) return old;
        return {
          ...old,
          pages: old.pages.map((page) => ({
            ...page,
            items: page.items.map((p) =>
              p.id === postId
                ? {
                    ...p,
                    reposted_by_me: !p.reposted_by_me,
                    reposts_count: (p.reposts_count ?? 0) + (p.reposted_by_me ? -1 : 1),
                  }
                : p
            ),
          })),
        };
      });
      try {
        await api.repostPost(postId);
        queryClient.invalidateQueries({ queryKey });
      } catch (e) {
        queryClient.setQueryData(queryKey, previous);
        toastError("No se pudo repostear", e);
      }
    },
    [profileId]
  );

  const handleEditPost = useCallback(
    async () => {
      queryClient.invalidateQueries({ queryKey: ["profile-feed", profileId] });
    },
    [profileId]
  );

  const handleDeletePost = useCallback(
    async (postId: string) => {
      try {
        await api.deletePost(postId);
        queryClient.invalidateQueries({ queryKey: ["profile-feed", profileId] });
      } catch (err) {
        console.error("Error deleting post:", err);
        throw err;
      }
    },
    [profileId]
  );

  const handleCreatePost = async () => {
    const hasText = postText.trim().length > 0;
    const hasImage = postImageUrl.trim().length > 0;
    if ((!hasText && !hasImage) || posting) return;
    setPosting(true);
    try {
      await api.createPost({
        body: hasText ? postText.trim() : undefined,
        image_url: postImageUrl || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ["profile-feed", profileId] });
      setPostText("");
      setPostImageUrl("");
    } catch (e) {
      toastError("No se pudo publicar", e);
    } finally {
      setPosting(false);
    }
  };

  const openEdit = () => {
    setShowEdit(true);
  };

  const handleSaveProfile = (updated: typeof profile) => {
    if (!updated) return;
    queryClient.setQueryData(["profile", profileId], updated);
    const { setUser } = useAuthStore.getState();
    setUser(updated);
    setShowEdit(false);
  };

  const handleSendFriendRequest = async () => {
    if (!profile || !authUser) return;
    setFrOverride((s) => ({ ...s, loading: true }));
    try {
      const fr = await api.sendFriendRequest(profile.id);
      setFrOverride({ status: "pending_sent", frId: fr.id, loading: false });
    } catch (e) {
      toastError("No se pudo enviar la solicitud", e);
      setFrOverride((s) => ({ ...s, loading: false }));
    }
  };

  const handleAcceptFriendRequest = async () => {
    if (!effectiveFrId) return;
    setFrOverride((s) => ({ ...s, loading: true }));
    try {
      await api.acceptFriendRequest(effectiveFrId);
      setFrOverride({ status: "accepted", frId: effectiveFrId, loading: false });
      queryClient.invalidateQueries({ queryKey: ["friends", profileId] });
      toastSuccess("Solicitud aceptada");
    } catch (e) {
      toastError("No se pudo aceptar la solicitud", e);
      setFrOverride((s) => ({ ...s, loading: false }));
    }
  };

  const handleRejectFriendRequest = async () => {
    if (!effectiveFrId) return;
    setFrOverride((s) => ({ ...s, loading: true }));
    try {
      await api.rejectFriendRequest(effectiveFrId);
      setFrOverride({ status: "rejected", frId: null, loading: false });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    } catch (e) {
      toastError("No se pudo rechazar la solicitud", e);
      setFrOverride((s) => ({ ...s, loading: false }));
    }
  };

  const handleCancelFriendRequest = async () => {
    if (!effectiveFrId) return;
    setFrOverride((s) => ({ ...s, loading: true }));
    try {
      await api.cancelFriendRequest(effectiveFrId);
      setFrOverride({ status: "none", frId: null, loading: false });
      queryClient.invalidateQueries({ queryKey: ["friend-requests"] });
    } catch (e) {
      toastError("No se pudo cancelar la solicitud", e);
      setFrOverride((s) => ({ ...s, loading: false }));
    }
  };

  if (postsLoading && !profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <MaterialIcon name="person" className="text-5xl text-outline-variant animate-pulse mb-3" />
        <p className="text-on-surface-variant text-body-md">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-8 pb-16">
      <ProfileHeader
        profile={profile}
        isOwn={isOwn}
        onEdit={openEdit}
        onMessage={() => router.push(`/messages?user=${profile.id}`)}
        onFriendAction={
          !isOwn
            ? {
                status: effectiveFrStatus,
                loading: frOverride.loading,
                onSend: handleSendFriendRequest,
                onAccept: handleAcceptFriendRequest,
                onReject: handleRejectFriendRequest,
                onCancel: handleCancelFriendRequest,
              }
            : undefined
        }
      />

      <div className="max-w-4xl mx-auto space-y-6">
        <StatsCards
          postsCount={postsTotal}
          friendsCount={friends.length}
          zerines={profile.zerines}
          memberSince={formatDateShort(profile.created_at)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          <ProfileDetails profile={profile} isOwn={isOwn} onUpdate={refetchProfile} />

          <FriendsGrid friends={friends} onShowAll={() => setShowAllFriends(true)} />

        </div>

        {/* Right Column (Posts) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Post Creation */}
          {isOwn && (
            <GlassCard className="p-6">
              <div className="flex items-start gap-3">
                <Avatar
                  src={profile.avatar_url}
                  alt={profile.name}
                  size="sm"
                  initials={profile.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                />
                <div className="flex-1">
                  <textarea
                    value={postText}
                    onChange={(e) => setPostText(e.target.value)}
                    placeholder="Qué está pasando en tu mundo mágico?"
                    className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none resize-none border border-outline-variant/20 focus:border-primary/40 transition-colors min-h-20"
                  />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="absolute opacity-0 w-0 h-0 pointer-events-none"
                    onChange={handlePostImageUpload}
                    disabled={uploadingPostImage}
                  />
                  {postImageUrl && (
                    <div className="mt-2 relative rounded-xl overflow-hidden">
                      <Image
                        src={postImageUrl}
                        alt="Preview"
                        width={400}
                        height={250}
                        className="w-full h-40 object-cover rounded-xl"
                        unoptimized
                      />
                      <button
                        onClick={() => setPostImageUrl("")}
                        className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                      >
                        <MaterialIcon name="close" className="text-lg" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                          postImageUrl
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        <MaterialIcon name="image" className="text-xl" />
                      </button>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleCreatePost}
                      disabled={(!postText.trim() && !postImageUrl.trim()) || posting}
                    >
                      {posting ? "Publicando..." : "Compartir"}
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Posts Feed */}
          {allPosts.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <MaterialIcon name="article" className="text-5xl text-outline-variant mb-3" />
              <p className="text-on-surface-variant text-body-md">Aún no hay publicaciones</p>
            </GlassCard>
          ) : (
            <>
            <div className="space-y-6">
              {visiblePosts.map((post) => (
                <PostCard
                  key={`${post.is_repost ? "r" : "p"}-${post.id}`}
                  post={post}
                  onLike={handleLike}
                  onRepost={handleRepost}
                  onShare={setShareTarget}
                  onEdit={handleEditPost}
                  onDelete={handleDeletePost}
                  currentUser={authUser ?? undefined}
                />
              ))}
            </div>
            <ListFooter
              hasMore={postsHasMore}
              loading={postsLoadingMore}
              pageSize={8}
              loaded={postsTotal}
              total={postsTotalCount}
              onLoadMore={loadMorePosts}
            />
            {/* Sentinel for IntersectionObserver-driven infinite scroll */}
            <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
            </>
          )}
        </div>
        </div>
      </div>

      {/* Share / Send Post Modal */}
      {shareTarget && (
        <SharePostModal post={shareTarget} onClose={() => setShareTarget(null)} />
      )}

      {/* All Friends Modal */}
      {showAllFriends && (
        <AllFriendsModal
          userId={profileId}
          initialFriends={friends}
          isOpen={showAllFriends}
          onClose={() => setShowAllFriends(false)}
          onUnfriend={() => {
            queryClient.invalidateQueries({ queryKey: ["friends", profileId] });
          }}
        />
      )}

      {/* Edit Profile Modal */}
      {showEdit && profile && authUser && (
        <EditProfileModal
          profile={profile}
          authUser={authUser}
          isOpen={showEdit}
          onClose={() => setShowEdit(false)}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
}

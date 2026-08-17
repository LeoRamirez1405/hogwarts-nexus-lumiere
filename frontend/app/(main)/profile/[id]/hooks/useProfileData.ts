"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { api, Post, User, FriendRequest } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { usePaginatedList } from "@/hooks/usePaginatedList";
import { toastError, toastSuccess } from "@/lib/toastStore";

type FrStatus = "none" | "pending_sent" | "pending_received" | "accepted" | "rejected";

interface FrOverride {
  status: FrStatus | null;
  frId: string | null;
  loading: boolean;
}

export interface FriendActionProps {
  status: FrStatus;
  loading: boolean;
  onSend: () => Promise<void>;
  onAccept: () => Promise<void>;
  onReject: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export function useProfileData(profileId: string) {
  const { user: authUser } = useAuthStore();

  const [frOverride, setFrOverride] = useState<FrOverride>({
    status: null,
    frId: null,
    loading: false,
  });

  const sentinelRef = useRef<HTMLDivElement>(null);

  const {
    items: allPosts,
    hasMore: postsHasMore,
    loading: postsLoading,
    loadingMore: postsLoadingMore,
    totalLoaded: postsTotal,
    totalCount: postsTotalCount,
    loadMore: loadMorePosts,
    refresh: refreshPosts,
  } = usePaginatedList({
    fetcher: (p) => api.getProfileFeed(profileId, p),
    pageSize: 8,
    enabled: !!profileId,
    queryKey: ["profile-feed", profileId],
  });

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

  const { data: friendRequests = [] } = useQuery<FriendRequest[]>({
    queryKey: ["friend-requests"],
    queryFn: () => api.getFriendRequests(),
    enabled: !!authUser && authUser.id !== profileId,
  });

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

  // ----- Friend request derivation -----
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

  const derivedFrStatus: FrStatus = !existingFr
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

  // ----- Friend request handlers -----
  const sendFriendRequest = useCallback(async () => {
    if (!profile || !authUser) return;
    setFrOverride((s) => ({ ...s, loading: true }));
    try {
      const fr = await api.sendFriendRequest(profile.id);
      setFrOverride({ status: "pending_sent", frId: fr.id, loading: false });
    } catch (e) {
      toastError("No se pudo enviar la solicitud", e);
      setFrOverride((s) => ({ ...s, loading: false }));
    }
  }, [profile, authUser]);

  const acceptFriendRequest = useCallback(async () => {
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
  }, [effectiveFrId, profileId]);

  const rejectFriendRequest = useCallback(async () => {
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
  }, [effectiveFrId]);

  const cancelFriendRequest = useCallback(async () => {
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
  }, [effectiveFrId]);

  const friendAction: FriendActionProps | undefined =
    authUser && authUser.id !== profileId
      ? {
          status: effectiveFrStatus,
          loading: frOverride.loading,
          onSend: sendFriendRequest,
          onAccept: acceptFriendRequest,
          onReject: rejectFriendRequest,
          onCancel: cancelFriendRequest,
        }
      : undefined;

  // ----- Post handlers -----
  const likePost = useCallback(
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
        queryClient.setQueryData(queryKey, previous);
        toastError("No se pudo dar like", e);
      }
    },
    [profileId]
  );

  const repostPost = useCallback(
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

  const editPost = useCallback(async () => {
    queryClient.invalidateQueries({ queryKey: ["profile-feed", profileId] });
  }, [profileId]);

  const deletePost = useCallback(
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

  const createPost = useCallback(
    async (input: {
      body?: string;
      image_url?: string;
      video_url?: string;
      video_poster_url?: string;
      video_duration?: number;
    }) => {
      const queryKey = ["profile-feed", profileId];
      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();

      const optimisticPost: Post = {
        id: tempId,
        author_id: authUser?.id ?? profileId,
        author: authUser ?? undefined,
        body: input.body ?? "",
        image_url: input.image_url,
        video_url: input.video_url,
        video_poster_url: input.video_poster_url,
        video_duration: input.video_duration,
        likes_count: 0,
        liked_by_me: false,
        reposts_count: 0,
        reposted_by_me: false,
        comments_count: 0,
        is_repost: false,
        created_at: now,
      };

      queryClient.setQueryData<{ pages?: { items: Post[] }[] }>(queryKey, (old) => {
        if (!old?.pages?.length) return old;
        return {
          ...old,
          pages: [
            {
              ...old.pages[0],
              items: [optimisticPost, ...old.pages[0].items],
            },
            ...old.pages.slice(1),
          ],
        };
      });

      try {
        await api.createPost({
          body: input.body,
          image_url: input.image_url,
          video_url: input.video_url,
          video_poster_url: input.video_poster_url,
          video_duration: input.video_duration,
        });
        toastSuccess("Publicado");
      } catch (e) {
        queryClient.invalidateQueries({ queryKey });
        throw e;
      }
      await queryClient.invalidateQueries({ queryKey });
    },
    [profileId, authUser]
  );

  const saveProfile = useCallback(
    (updated: User) => {
      queryClient.setQueryData(["profile", profileId], updated);
      const { setUser } = useAuthStore.getState();
      setUser(updated);
    },
    [profileId]
  );

  return {
    profile,
    refetchProfile,
    profileError,
    friends,
    posts: allPosts,
    postsHasMore,
    postsLoading,
    postsLoadingMore,
    postsTotal,
    postsTotalCount,
    loadMorePosts,
    refreshPosts,
    sentinelRef,
    friendAction,
    likePost,
    repostPost,
    editPost,
    deletePost,
    createPost,
    saveProfile,
    invalidateFriends: () =>
      queryClient.invalidateQueries({ queryKey: ["friends", profileId] }),
  };
}

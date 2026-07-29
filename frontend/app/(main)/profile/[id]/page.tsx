"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/authStore";
import { api, User, Post } from "@/lib/api";
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
import { useCollapsibleList } from "@/hooks/useCollapsibleList";

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: authUser } = useAuthStore();
  const profileId = (params?.id as string) || authUser?.id;

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState("");
  const [posting, setPosting] = useState(false);
  const [postImageUrl, setPostImageUrl] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [frStatus, setFrStatus] = useState<"none" | "pending_sent" | "pending_received" | "accepted" | "rejected">("none");
  const [currentFrId, setCurrentFrId] = useState<string | null>(null);
  const [frLoading, setFrLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => setPostImageUrl(result.url),
  });

  const isOwn = authUser?.id === profileId;

  const { visibleItems: visiblePosts, ...postList } = useCollapsibleList(posts, 8);

  const reloadProfile = useCallback(async () => {
    if (!profileId) return;
    try {
      const u = await api.getUser(profileId);
      setProfile(u);
    } catch {}
  }, [profileId]);

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    Promise.all([
      api.getUser(profileId),
      api.getProfileFeed(profileId),
      api.getFriends(profileId),
      api.getFriendRequests(),
    ])
      .then(([u, feed, friendUsers, frs]) => {
        if (cancelled) return;
        setProfile(u);
        setPosts(feed);
        setFriends(friendUsers);
        if (authUser && authUser.id !== profileId) {
          const existing = frs.find(
            (fr) =>
              (fr.sender_id === authUser.id && fr.receiver_id === profileId) ||
              (fr.sender_id === profileId && fr.receiver_id === authUser.id)
          );
          if (existing) {
            setCurrentFrId(existing.id);
            if (existing.status === "accepted") setFrStatus("accepted");
            else if (existing.status === "rejected") setFrStatus("rejected");
            else if (existing.sender_id === authUser.id) setFrStatus("pending_sent");
            else setFrStatus("pending_received");
          }
        }
      })
      .catch(() => {
        if (!cancelled) router.push("/dashboard");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [profileId, router, authUser]);

  const handleLike = useCallback(async (postId: string) => {
    try {
      const result = await api.likePost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                liked_by_me: result.liked_by_me,
                likes_count: result.likes_count,
              }
            : p
        )
      );
    } catch {}
  }, []);

  const handleRepost = useCallback(async (postId: string) => {
    try {
      const result = await api.repostPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                reposted_by_me: result.reposted_by_me,
                reposts_count: result.reposts_count,
              }
            : p
        )
      );
    } catch {}
  }, []);

  const handleCreatePost = async () => {
    if (!postText.trim() || posting) return;
    setPosting(true);
    try {
      const newPost = await api.createPost({
        body: postText.trim(),
        image_url: postImageUrl || undefined,
      });
      setPosts((prev) => [{ ...newPost, author: profile! }, ...prev]);
      setPostText("");
      setPostImageUrl("");
    } catch {}
    setPosting(false);
  };

  function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.toLocaleDateString("es-ES", { day: "numeric" });
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

  const openEdit = () => {
    setShowEdit(true);
  };

  const handleSaveProfile = async (updated: User) => {
    setProfile(updated);
    const { setUser } = useAuthStore.getState();
    setUser(updated);
    setShowEdit(false);
  };

  const handleSendFriendRequest = async () => {
    if (!profile || !authUser) return;
    setFrLoading(true);
    try {
      const fr = await api.sendFriendRequest(profile.id);
      setCurrentFrId(fr.id);
      setFrStatus("pending_sent");
    } catch {}
    setFrLoading(false);
  };

  const handleAcceptFriendRequest = async () => {
    if (!currentFrId) return;
    setFrLoading(true);
    try {
      await api.acceptFriendRequest(currentFrId);
      setFrStatus("accepted");
    } catch {}
    setFrLoading(false);
  };

  const handleRejectFriendRequest = async () => {
    if (!currentFrId) return;
    setFrLoading(true);
    try {
      await api.rejectFriendRequest(currentFrId);
      setFrStatus("rejected");
      setCurrentFrId(null);
    } catch {}
    setFrLoading(false);
  };

  const handleCancelFriendRequest = async () => {
    if (!currentFrId) return;
    setFrLoading(true);
    try {
      await api.cancelFriendRequest(currentFrId);
      setFrStatus("none");
      setCurrentFrId(null);
    } catch {}
    setFrLoading(false);
  };

  if (loading) {
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
                status: frStatus,
                loading: frLoading,
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
          postsCount={posts.length}
          friendsCount={friends.length}
          zerines={profile.zerines}
          memberSince={formatDateShort(profile.created_at)}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          <ProfileDetails profile={profile} isOwn={isOwn} onUpdate={reloadProfile} />

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
                    placeholder="Que esta pasando en tu mundo magico?"
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
                      disabled={!postText.trim() || posting}
                    >
                      {posting ? "Publicando..." : "Compartir"}
                    </Button>
                  </div>
                </div>
              </div>
            </GlassCard>
          )}

          {/* Posts Feed */}
          {posts.length === 0 ? (
            <GlassCard className="p-12 text-center">
              <MaterialIcon name="article" className="text-5xl text-outline-variant mb-3" />
              <p className="text-on-surface-variant text-body-md">Aun no hay publicaciones</p>
            </GlassCard>
          ) : (
            <>
              <div className={postList.expanded ? "space-y-6 max-h-[75vh] overflow-y-auto pr-1" : "space-y-6"}>
                {visiblePosts.map((post) => (
                  <PostCard
                    key={`${post.is_repost ? "r" : "p"}-${post.id}`}
                    post={post}
                    onLike={handleLike}
                    onRepost={handleRepost}
                    onShare={setShareTarget}
                    currentUser={authUser ?? undefined}
                  />
                ))}
              </div>
              <ListFooter {...postList} onToggle={postList.toggle} />
            </>
          )}
        </div>
      </div>

      {/* Share / Send Post Modal */}
      {shareTarget && (
        <SharePostModal post={shareTarget} onClose={() => setShareTarget(null)} />
      )}

      {/* All Friends Modal */}
      {showAllFriends && (
        <AllFriendsModal friends={friends} isOpen={showAllFriends} onClose={() => setShowAllFriends(false)} />
      )}

      {/* Edit Profile Modal */}
      <EditProfileModal
        profile={profile!}
        authUser={authUser!}
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSave={handleSaveProfile}
      />
    </div>
    </div>
  );
}
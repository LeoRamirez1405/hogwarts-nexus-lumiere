"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { Post } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import {
  ProfileHeader,
  StatsCards,
  FriendsGrid,
} from "@/components/domain/Profile";
import { MaterialIcon, Skeleton } from "@/components/ui";
import ProfileDetails from "./ProfileDetails";
import { BioSection } from "./components/BioSection";
import { useProfileData } from "./hooks/useProfileData";
import { PostComposer } from "./components/PostComposer";
import { PostsFeed } from "./components/PostsFeed";
import PullToRefresh from "@/components/ui/PullToRefresh";

const SharePostModal = dynamic(() =>
  import("@/components/domain/Profile/SharePostModal").then((m) => m.SharePostModal),
  { ssr: false }
);

const EditProfileModal = dynamic(() =>
  import("@/components/domain/Profile/EditProfileModal").then((m) => m.EditProfileModal),
  { ssr: false }
);

const AllFriendsModal = dynamic(() =>
  import("@/components/domain/Profile/AllFriendsModal").then((m) => m.AllFriendsModal),
  { ssr: false }
);

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
  const { user: authUser } = useAuthStore();
  const profileId = (params?.id as string) ?? authUser?.id ?? "";
  const router = useRouter();

  const [showEdit, setShowEdit] = useState(false);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [showAllFriends, setShowAllFriends] = useState(false);

  const {
    profile,
    refetchProfile,
    profileError,
    friends,
    posts,
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
    invalidateFriends,
  } = useProfileData(profileId);

  const isOwn = authUser?.id === profileId;

  useEffect(() => {
    if (profileError) router.push("/dashboard");
  }, [profileError, router]);

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
    <PullToRefresh onRefresh={refreshPosts}>
      <div className="space-y-8 pb-16">
<ProfileHeader
           profile={profile}
           isOwn={isOwn}
           onEdit={() => setShowEdit(true)}
           onMessage={() => router.push(`/messages?user=${profile.id}`)}
           onFriendAction={friendAction}
         />

         {/* Bio Section */}
         <div className="max-w-4xl mx-auto -mt-4">
           <BioSection profile={profile} />
         </div>

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
                <PostComposer profile={profile} onCreate={createPost} />
              )}

              {/* Posts Feed */}
              {postsLoading ? (
                <div className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} variant="post" />
                  ))}
                </div>
              ) : (
                <PostsFeed
                posts={posts}
                hasMore={postsHasMore}
                loadingMore={postsLoadingMore}
                total={postsTotal}
                totalCount={postsTotalCount}
                onLoadMore={loadMorePosts}
                sentinelRef={sentinelRef}
                onLike={likePost}
                onRepost={repostPost}
                onShare={setShareTarget}
                onEdit={editPost}
                onDelete={deletePost}
                currentUser={authUser ?? undefined}
              />
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
            onUnfriend={invalidateFriends}
          />
        )}

        {/* Edit Profile Modal */}
        {showEdit && profile && authUser && (
          <EditProfileModal
            profile={profile}
            authUser={authUser}
            isOpen={showEdit}
            onClose={() => setShowEdit(false)}
            onSave={saveProfile}
          />
        )}
      </div>
    </PullToRefresh>
  );
}

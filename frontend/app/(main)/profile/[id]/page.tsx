"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/authStore";
import { api, User, Post, PostComment, Conversation, SharedPostMeta } from "@/lib/api";
import { Avatar, GlassCard, Button, ProgressBar, Badge } from "@/components/ui";
import ProfileDetails from "./ProfileDetails";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

const EMOJIS = [
  "😀","😂","😍","🥳","😎","🤩","💀","👻","🔥","✨",
  "❤️","💎","⚡","🌟","🎉","🎊","🦋","猫","🦉","🏰",
  " wand","📜","🧪","⚗️","🔮","🗝️","🧣","📚"," cauldron","🪄",
];

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.toLocaleDateString("es-ES", { day: "numeric" });
  const month = d.toLocaleDateString("es-ES", { month: "short" }).replace(".", "");
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRelative(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

function PostCard({
  post,
  onLike,
  onRepost,
  onShare,
  currentUser,
}: {
  post: Post;
  onLike: (id: string) => void;
  onRepost: (id: string) => void;
  onShare: (post: Post) => void;
  currentUser?: User;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentsLoaded, setCommentsLoaded] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const displayedCommentCount = commentsLoaded
    ? comments.length
    : post.comments_count ?? 0;

  const toggleComments = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && !commentsLoaded) {
      setLoadingComments(true);
      try {
        const data = await api.getComments(post.id);
        setComments(data);
        setCommentsLoaded(true);
      } catch {}
      setLoadingComments(false);
    }
  };

  const handleComment = async () => {
    const text = commentText.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const created = await api.addComment(post.id, text);
      setComments((prev) => [...prev, created]);
      setCommentText("");
    } catch {}
    setSending(false);
  };

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <GlassCard className="p-6 relative">
      {post.is_repost && post.reposted_by && (
        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-outline-variant/10 text-label-sm text-on-surface-variant">
          <MaterialIcon name="repeat" className="text-base text-success" />
          <span>
            {post.reposted_by.id === currentUser?.id
              ? "Reposteaste"
              : `${post.reposted_by.name} reposteó`}
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${post.author_id}`}>
          <Avatar
            src={post.author?.avatar_url}
            alt={post.author?.name}
            size="sm"
            initials={post.author?.name
              ?.split(" ")
              .map((n) => n[0])
              .join("")}
          />
        </Link>
        <div className="flex-1">
          <Link
            href={`/profile/${post.author_id}`}
            className="text-body-md font-semibold text-on-surface hover:text-primary transition-colors"
          >
            {post.author?.name ?? "Usuario"}
          </Link>
          <p className="text-label-sm text-on-surface-variant">
            {formatRelative(post.created_at)}
          </p>
        </div>
      </div>
      <p className="text-body-md text-on-surface mb-4 whitespace-pre-wrap">
        {post.body}
      </p>
      {post.image_url && (
        <div className="mb-4 rounded-xl overflow-hidden">
          <Image
            src={post.image_url}
            alt="Post"
            width={600}
            height={400}
            className="w-full h-auto object-cover"
          />
        </div>
      )}
      <div className="flex items-center gap-6 pt-3 border-t border-outline-variant/20">
        <button
          onClick={() => onLike(post.id)}
          className={`flex items-center gap-2 text-label-sm transition-colors ${
            post.liked_by_me
              ? "text-error"
              : "text-on-surface-variant hover:text-error"
          }`}
        >
          <MaterialIcon
            name={post.liked_by_me ? "favorite" : "favorite_border"}
            className="text-lg"
            filled={!!post.liked_by_me}
          />
          {post.likes_count ?? 0}
        </button>
        <button
          onClick={toggleComments}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon
            name={showComments ? "chat_bubble" : "chat_bubble_outline"}
            className="text-lg"
            filled={showComments}
          />
          {displayedCommentCount > 0 ? displayedCommentCount : "Comentar"}
        </button>
        <button
          onClick={() => onRepost(post.id)}
          className={`flex items-center gap-2 text-label-sm transition-colors ${
            post.reposted_by_me
              ? "text-success"
              : "text-on-surface-variant hover:text-success"
          }`}
          title={post.reposted_by_me ? "Quitar repost" : "Repostear"}
        >
          <MaterialIcon
            name="repeat"
            className="text-lg"
            filled={!!post.reposted_by_me}
          />
          {post.reposts_count ?? 0}
        </button>
        <button
          onClick={() => onShare(post)}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-secondary transition-colors"
          title="Compartir a un chat o grupo"
        >
          <MaterialIcon name="share" className="text-lg" />
          Compartir
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
          {loadingComments && (
            <p className="text-label-sm text-on-surface-variant">
              Cargando comentarios...
            </p>
          )}
          {!loadingComments && comments.length === 0 && (
            <p className="text-label-sm text-on-surface-variant/70">
              Aun no hay comentarios. Se el primero.
            </p>
          )}
          {comments.map((c) => (
            <Link
              key={c.id}
              href={`/profile/${c.user_id}`}
              className="flex items-start gap-2 group"
            >
              <Avatar
                size="sm"
                src={c.author?.avatar_url}
                alt={c.author?.name}
                initials={initialsOf(c.author?.name)}
                className="w-7! h-7!"
              />
              <div className="flex-1 bg-surface-container-low rounded-xl px-3 py-2">
                <p className="text-label-sm font-semibold text-on-surface group-hover:text-primary transition-colors">
                  {c.author?.name ?? "Usuario"}
                </p>
                <p className="text-body-md text-on-surface">{c.body}</p>
              </div>
            </Link>
          ))}
          <div className="flex items-start gap-2 relative">
            <Avatar
              size="sm"
              src={currentUser?.avatar_url}
              alt={currentUser?.name}
              initials={initialsOf(currentUser?.name) || "?"}
              className="w-7! h-7!"
            />
            <div className="flex-1 relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder="Escribe un comentario..."
                className="w-full bg-surface-container-low rounded-xl px-3 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors pr-10"
              />
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="mood" className="text-lg" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl p-3 grid grid-cols-5 gap-1 z-20 w-64">
                  {EMOJIS.map((e) => (
                    <button
                      key={e}
                      onClick={() => insertEmoji(e)}
                      className="p-1.5 rounded-lg hover:bg-surface-container-high text-lg transition-colors"
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={handleComment}
              disabled={!commentText.trim() || sending}
              className="w-9 h-9 inline-flex items-center justify-center rounded-full bg-primary text-on-primary disabled:opacity-30 transition-opacity"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function SharePostModal({
  post,
  onClose,
}: {
  post: Post;
  onClose: () => void;
}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getConversations()
      .then((c) => {
        if (!cancelled) setConversations(c);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const meta: SharedPostMeta = {
    id: post.id,
    author_id: post.author_id,
    author_name: post.author?.name,
    author_avatar: post.author?.avatar_url,
    body: post.body,
    image_url: post.image_url,
    created_at: post.created_at,
  };

  const handleSend = async (conv: Conversation) => {
    if (sendingId || sentIds.includes(conv.id)) return;
    setSendingId(conv.id);
    try {
      const data = {
        kind: "post" as const,
        body: `Compartio una publicacion de ${post.author?.name ?? "un usuario"}`,
        metadata: { post: meta },
      };
      if (conv.type === "room") {
        await api.sendRoomMessage(conv.id, data);
      } else {
        await api.sendMessage({ ...data, receiver_id: conv.id });
      }
      setSentIds((prev) => [...prev, conv.id]);
    } catch {}
    setSendingId(null);
  };

  const filtered = search
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="font-display text-title-md text-on-surface">
            Compartir publicacion
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        {/* Post preview */}
        <div className="px-6 pt-4">
          <div className="flex items-start gap-2 bg-surface-container-low rounded-xl p-3 border border-outline-variant/20">
            <Avatar
              size="sm"
              src={post.author?.avatar_url}
              alt={post.author?.name}
              initials={initialsOf(post.author?.name)}
              className="w-7! h-7!"
            />
            <div className="min-w-0">
              <p className="text-label-sm font-semibold text-on-surface">
                {post.author?.name ?? "Usuario"}
              </p>
              <p className="text-label-sm text-on-surface-variant line-clamp-2">
                {post.body}
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar chat o grupo..."
            className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/40 transition-colors"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 no-scrollbar">
          {loading ? (
            <p className="text-center text-label-sm text-on-surface-variant py-8">
              Cargando conversaciones...
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-label-sm text-on-surface-variant py-8">
              No hay conversaciones
            </p>
          ) : (
            filtered.map((conv) => {
              const sent = sentIds.includes(conv.id);
              return (
                <div
                  key={`${conv.type}-${conv.id}`}
                  className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-surface-container-low transition-colors"
                >
                  <Avatar
                    size="sm"
                    src={conv.avatar_url}
                    alt={conv.name}
                    initials={initialsOf(conv.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface truncate">
                      {conv.name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      {conv.type === "room" ? "Grupo" : "Chat directo"}
                    </p>
                  </div>
                  <Button
                    variant={sent ? "ghost" : "primary"}
                    size="sm"
                    icon={sent ? "check" : "send"}
                    onClick={() => handleSend(conv)}
                    disabled={sent || sendingId === conv.id}
                  >
                    {sent ? "Enviado" : sendingId === conv.id ? "..." : "Enviar"}
                  </Button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

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
  const [uploadingPostImage, setUploadingPostImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", bio: "", avatar_url: "", house: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [frStatus, setFrStatus] = useState<"none" | "pending_sent" | "pending_received" | "accepted" | "rejected">("none");
  const [currentFrId, setCurrentFrId] = useState<string | null>(null);
  const [frLoading, setFrLoading] = useState(false);
  const [shareTarget, setShareTarget] = useState<Post | null>(null);
  const [showAllFriends, setShowAllFriends] = useState(false);
  const [friendsSearch, setFriendsSearch] = useState("");

  const filteredFriends = friendsSearch
    ? friends.filter((f) =>
        f.name.toLowerCase().includes(friendsSearch.toLowerCase())
      )
    : friends;

  const isOwn = authUser?.id === profileId;

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

  const openEdit = () => {
    setEditForm({
      name: profile?.name ?? "",
      bio: profile?.bio ?? "",
      avatar_url: profile?.avatar_url ?? "",
      house: profile?.house ?? "",
    });
    setShowEdit(true);
  };

  const handleSaveProfile = async () => {
    if (!profile || !authUser) return;
    setSavingProfile(true);
    try {
      const updated = await api.updateUser(authUser.id, {
        name: editForm.name,
        bio: editForm.bio || undefined,
        avatar_url: editForm.avatar_url || undefined,
        house: editForm.house || undefined,
      });
      setProfile(updated);
      // Update auth store so Sidebar and TopBar reflect changes immediately
      const { setUser } = useAuthStore.getState();
      setUser(updated);
      setShowEdit(false);
    } catch {}
    setSavingProfile(false);
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const result = await api.uploadFile(file);
      setEditForm((p) => ({ ...p, avatar_url: result.url }));
    } catch {
      // error handled by api
    }
    setUploadingAvatar(false);
    e.target.value = "";
  };

  const handlePostImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPostImage(true);
    try {
      const result = await api.uploadFile(file);
      setPostImageUrl(result.url);
    } catch {
      // error handled by api
    }
    setUploadingPostImage(false);
    e.target.value = "";
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
        <MaterialIcon
          name="person"
          className="text-5xl text-outline-variant animate-pulse mb-3"
        />
        <p className="text-on-surface-variant text-body-md">Cargando perfil...</p>
      </div>
    );
  }

  if (!profile) return null;

  const zerinesNext = 2000;

  return (
    <div className="space-y-8 pb-16">
      {/* Banner */}
      <div className="relative">
        <div className="h-48 md:h-56 bg-linear-to-br from-primary via-primary-container to-secondary rounded-2xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
        </div>
        <div className="max-w-4xl mx-auto px-4">
          <div className="relative -mt-16 md:-mt-20 flex items-end gap-6">
            <div className="relative">
              <Avatar
                src={profile.avatar_url}
                alt={profile.name}
                size="xl"
                borderColor="primary"
                initials={profile.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
                className="w-32! h-32! md:w-40! md:h-40! border-4 border-white shadow-xl"
              />
              {profile.role === "admin" && (
                <span className="absolute bottom-2 right-2 bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded-full shadow-lg">
                  <MaterialIcon
                    name="verified"
                    className="text-xl"
                    filled
                  />
                </span>
              )}
            </div>
            <div className="pb-2 flex-1">
              <h1 className="font-display text-display-lg text-on-surface leading-tight">
                {profile.name}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {profile.house && (
                  <Badge variant="tag" color="secondary">
                    {profile.house}
                  </Badge>
                )}
                <span className="text-primary text-body-md font-body">
                  {profile.role === "admin" ? "Admin" : "Estudiante"}
                </span>
              </div>
            </div>
            {!isOwn ? (
              <div className="hidden md:flex pb-2 gap-3">
                <Button variant="primary" icon="mail">
                  Mensaje
                </Button>
                {frStatus === "none" && (
                  <Button variant="secondary" icon="person_add" onClick={handleSendFriendRequest} disabled={frLoading}>
                    Agregar
                  </Button>
                )}
                {frStatus === "pending_sent" && (
                  <Button variant="ghost" icon="hourglass_top" onClick={handleCancelFriendRequest} disabled={frLoading}>
                    Pendiente
                  </Button>
                )}
                {frStatus === "pending_received" && (
                  <>
                    <Button variant="primary" icon="check" onClick={handleAcceptFriendRequest} disabled={frLoading}>
                      Aceptar
                    </Button>
                    <Button variant="ghost" icon="close" onClick={handleRejectFriendRequest} disabled={frLoading}>
                      Rechazar
                    </Button>
                  </>
                )}
                {frStatus === "accepted" && (
                  <Button variant="secondary" icon="group" disabled>
                    Amigos
                  </Button>
                )}
                {frStatus === "rejected" && (
                  <Button variant="ghost" icon="person_add" onClick={handleSendFriendRequest} disabled={frLoading}>
                    Agregar
                  </Button>
                )}
              </div>
            ) : (
              <div className="hidden md:flex pb-2">
                <Button variant="primary" icon="edit" onClick={openEdit}>
                  Editar Perfil
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bio */}
      {profile.bio && (
        <GlassCard className="max-w-4xl mx-auto px-8 py-6 border-t border-secondary/10">
          <p className="text-body-md text-on-surface-variant italic">
            &ldquo;{profile.bio}&rdquo;
          </p>
        </GlassCard>
      )}

      <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="material-symbols-outlined text-primary text-2xl mb-1" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
            article
          </span>
          <p className="font-display text-title-md text-on-surface">{posts.length}</p>
          <p className="text-label-sm text-on-surface-variant">Publicaciones</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="material-symbols-outlined text-secondary text-2xl mb-1" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
            group
          </span>
          <p className="font-display text-title-md text-on-surface">{friends.length}</p>
          <p className="text-label-sm text-on-surface-variant">Amigos</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="material-symbols-outlined text-secondary text-2xl mb-1" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
            diamond
          </span>
          <p className="font-display text-title-md text-secondary">{profile.zerines.toLocaleString()}</p>
          <p className="text-label-sm text-on-surface-variant">Zerines</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <span className="material-symbols-outlined text-success text-2xl mb-1" style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
            calendar_today
          </span>
          <p className="font-display text-title-md text-on-surface">{formatDateShort(profile.created_at)}</p>
          <p className="text-label-sm text-on-surface-variant">Se unio</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stats */}
          
          {/* Details */}
          <ProfileDetails
            profile={profile}
            isOwn={isOwn}
            onUpdate={reloadProfile}
          />

          {/* Friends */}
          <GlassCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-md font-display text-on-surface">
                Amigos
              </h3>
              <span className="text-label-sm text-on-surface-variant">
                {friends.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {friends.slice(0, 6).map((f) => (
                <Link
                  key={f.id}
                  href={`/profile/${f.id}`}
                  className="flex flex-col items-center gap-1 group"
                >
                  <Avatar
                    src={f.avatar_url}
                    alt={f.name}
                    size="sm"
                    initials={f.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                    className="group-hover:ring-2 group-hover:ring-primary transition-all"
                  />
                  <span className="text-[11px] text-on-surface-variant text-center truncate w-full group-hover:text-primary transition-colors">
                    {f.name.split(" ")[0]}
                  </span>
                </Link>
              ))}
            </div>
            {friends.length > 6 && (
              <button
                onClick={() => setShowAllFriends(true)}
                className="w-full mt-4 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container-high text-on-surface-variant hover:text-primary text-label-sm font-medium transition-colors"
              >
                Ver todos ({friends.length})
              </button>
            )}
          </GlassCard>

          {/* Zerines Progress */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MaterialIcon
                name="diamond"
                className="text-secondary"
                filled
              />
              <h3 className="text-title-md font-display text-on-surface">
                Zerines
              </h3>
            </div>
            <div className="text-center mb-4">
              <p className="text-headline-lg font-display text-secondary">
                {profile.zerines.toLocaleString()}
              </p>
              <p className="text-label-sm text-on-surface-variant">
                de {zerinesNext.toLocaleString()} para proximo nivel
              </p>
            </div>
            <ProgressBar
              value={profile.zerines}
              max={zerinesNext}
              color="secondary"
              showValue
            />
          </GlassCard>
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
                    className="hidden"
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
              <MaterialIcon
                name="article"
                className="text-5xl text-outline-variant mb-3"
              />
              <p className="text-on-surface-variant text-body-md">
                Aun no hay publicaciones
              </p>
            </GlassCard>
          ) : (
            posts.map((post) => (
              <PostCard
                key={`${post.is_repost ? "r" : "p"}-${post.id}`}
                post={post}
                onLike={handleLike}
                onRepost={handleRepost}
                onShare={setShareTarget}
                currentUser={authUser ?? undefined}
              />
            ))
          )}
        </div>
      </div>

      {/* Share / Send Post Modal */}
      {shareTarget && (
        <SharePostModal post={shareTarget} onClose={() => setShareTarget(null)} />
      )}

      {/* All Friends Modal (Facebook-style) */}
      {showAllFriends && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAllFriends(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface z-10">
              <div>
                <h2 className="font-display text-title-md text-on-surface">
                  Amigos
                </h2>
                <p className="text-label-sm text-on-surface-variant">
                  {friends.length} {friends.length === 1 ? "amigo" : "amigos"}
                </p>
              </div>
              <button
                onClick={() => setShowAllFriends(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>
            <div className="px-6 py-3 border-b border-outline-variant/10">
              <div className="relative">
                <MaterialIcon
                  name="search"
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-lg"
                />
                <input
                  type="text"
                  value={friendsSearch}
                  onChange={(e) => setFriendsSearch(e.target.value)}
                  placeholder="Buscar amigos..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
              {filteredFriends.length === 0 ? (
                <p className="text-center text-label-sm text-on-surface-variant py-8">
                  {friendsSearch ? "No se encontraron amigos" : "Sin amigos todavia"}
                </p>
              ) : (
                <div className="space-y-1">
                  {filteredFriends.map((f) => (
                    <Link
                      key={f.id}
                      href={`/profile/${f.id}`}
                      onClick={() => setShowAllFriends(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low transition-colors group"
                    >
                      <Avatar
                        src={f.avatar_url}
                        alt={f.name}
                        size="md"
                        initials={f.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface group-hover:text-primary transition-colors truncate">
                          {f.name}
                        </p>
                        {f.house && (
                          <p className="text-label-sm text-on-surface-variant truncate">
                            {f.house}
                          </p>
                        )}
                      </div>
                      <MaterialIcon
                        name="chevron_right"
                        className="text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity"
                      />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowEdit(false)}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] overflow-y-auto no-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface z-10">
              <h2 className="font-display text-title-md text-on-surface">Editar Perfil</h2>
              <button
                onClick={() => setShowEdit(false)}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Nombre</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                />
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Casa</label>
                <select
                  value={editForm.house}
                  onChange={(e) => setEditForm((p) => ({ ...p, house: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
                >
                  <option value="">Sin casa</option>
                  <option value="Gryffindor">Gryffindor</option>
                  <option value="Slytherin">Slytherin</option>
                  <option value="Ravenclaw">Ravenclaw</option>
                  <option value="Hufflepuff">Hufflepuff</option>
                </select>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Avatar</label>
                <div className="flex items-center gap-3">
                  {editForm.avatar_url && (
                    <Image
                      src={editForm.avatar_url}
                      alt="Preview"
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                      unoptimized
                    />
                  )}
                  <div className="flex-1">
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      icon="upload"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={uploadingAvatar}
                    >
                      {uploadingAvatar ? "Subiendo..." : "Seleccionar archivo"}
                    </Button>
                    {editForm.avatar_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon="delete"
                        onClick={() => setEditForm((p) => ({ ...p, avatar_url: "" }))}
                      >
                        Eliminar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">Biografia (opcional)</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm((p) => ({ ...p, bio: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-25 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-outline-variant/20 sticky bottom-0 bg-surface">
              <Button variant="secondary" onClick={() => setShowEdit(false)} className="flex-1">Cancelar</Button>
              <Button variant="primary" onClick={handleSaveProfile} disabled={savingProfile || !editForm.name.trim()} className="flex-1">
                {savingProfile ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

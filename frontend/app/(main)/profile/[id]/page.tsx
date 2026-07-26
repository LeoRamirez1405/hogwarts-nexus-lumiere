"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/authStore";
import { api, User, Post } from "@/lib/api";
import { Avatar, GlassCard, Button, ProgressBar, Badge } from "@/components/ui";

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

interface Comment {
  id: string;
  author: string;
  authorId: string;
  body: string;
  created_at: string;
}

function PostCard({
  post,
  onLike,
  currentUserId,
  profileUser,
}: {
  post: Post;
  onLike: (id: string) => void;
  currentUserId?: string;
  profileUser?: User;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState<Comment[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [toast, setToast] = useState("");

  const handleComment = () => {
    if (!commentText.trim()) return;
    const newComment: Comment = {
      id: Date.now().toString(),
      author: profileUser?.name || "Tu",
      authorId: currentUserId || "",
      body: commentText.trim(),
      created_at: new Date().toISOString(),
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText("");
  };

  const handleShare = () => {
    const url = `${window.location.origin}/profile/${post.author_id}`;
    navigator.clipboard.writeText(url).then(() => {
      setToast("Link copiado al portapapeles");
      setTimeout(() => setToast(""), 2000);
    });
  };

  const insertEmoji = (emoji: string) => {
    setCommentText((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  return (
    <GlassCard className="p-6 relative">
      {toast && (
        <div className="absolute top-4 right-4 bg-primary text-on-primary px-4 py-2 rounded-xl text-label-sm shadow-lg z-10 animate-pulse">
          {toast}
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
            post.liked
              ? "text-error"
              : "text-on-surface-variant hover:text-error"
          }`}
        >
          <MaterialIcon
            name={post.liked ? "favorite" : "favorite_border"}
            className="text-lg"
            filled={!!post.liked}
          />
          {post.likes_count ?? 0}
        </button>
        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          <MaterialIcon
            name={showComments ? "chat_bubble" : "chat_bubble_outline"}
            className="text-lg"
            filled={showComments}
          />
          {comments.length > 0 ? comments.length : "Comentar"}
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-2 text-label-sm text-on-surface-variant hover:text-secondary transition-colors"
        >
          <MaterialIcon name="share" className="text-lg" />
          Compartir
        </button>
      </div>

      {showComments && (
        <div className="mt-4 pt-4 border-t border-outline-variant/20 space-y-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar
                size="sm"
                initials={c.author.split(" ").map((n) => n[0]).join("")}
                className="w-7! h-7!"
              />
              <div className="flex-1 bg-surface-container-low rounded-xl px-3 py-2">
                <p className="text-label-sm font-semibold text-on-surface">
                  {c.author}
                </p>
                <p className="text-body-md text-on-surface">{c.body}</p>
              </div>
            </div>
          ))}
          <div className="flex items-start gap-2 relative">
            <Avatar
              size="sm"
              initials={currentUserId ? "Tu" : "?"}
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
              disabled={!commentText.trim()}
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

  const isOwn = authUser?.id === profileId;

  useEffect(() => {
    if (!profileId) return;
    let cancelled = false;
    Promise.all([
      api.getUser(profileId),
      api.getPosts(),
      api.getUsers(),
      api.getFriendRequests(),
    ])
      .then(([u, allPosts, allUsers, frs]) => {
        if (cancelled) return;
        setProfile(u);
        setPosts(
          allPosts.filter((p) => p.author_id === profileId)
        );
        setFriends(
          allUsers.filter((u) => u.id !== profileId).slice(0, 9)
        );
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
                liked: result.liked,
                likes_count: result.likes_count,
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
          <p className="font-display text-title-md text-on-surface">{formatDate(profile.created_at).split(" ").slice(0, 2).join(" ")}</p>
          <p className="text-label-sm text-on-surface-variant">Se unio</p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Stats */}
          <GlassCard className="p-6 parchment-top-bottom">
            <h3 className="text-title-md font-display text-on-surface mb-4">
              Estadisticas
            </h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-headline-lg font-display text-primary">
                  {posts.length}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Publicaciones
                </p>
              </div>
              <div>
                <p className="text-headline-lg font-display text-primary">
                  {friends.length}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Amigos
                </p>
              </div>
              <div>
                <p className="text-headline-lg font-display text-secondary">
                  {profile.zerines.toLocaleString()}
                </p>
                <p className="text-label-sm text-on-surface-variant">
                  Zerines
                </p>
              </div>
            </div>
          </GlassCard>

          {/* Details */}
          <GlassCard className="p-6">
            <h3 className="text-title-md font-display text-on-surface mb-4">
              Detalles
            </h3>
            <ul className="space-y-3">
              <li className="flex items-center gap-3 border-l-4 border-secondary pl-3">
                <MaterialIcon
                  name="location_on"
                  className="text-lg text-secondary"
                />
                <span className="text-body-md text-on-surface-variant">
                  Hogwarts
                </span>
              </li>
              <li className="flex items-center gap-3 border-l-4 border-secondary pl-3">
                <MaterialIcon
                  name="auto_fix_high"
                  className="text-lg text-secondary"
                />
                <span className="text-body-md text-on-surface-variant">
                  Sauco & Pelo de Unicornio
                </span>
              </li>
              <li className="flex items-center gap-3 border-l-4 border-secondary pl-3">
                <MaterialIcon
                  name="calendar_today"
                  className="text-lg text-secondary"
                />
                <span className="text-body-md text-on-surface-variant">
                  Se unio {formatDate(profile.created_at)}
                </span>
              </li>
            </ul>
          </GlassCard>

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
                key={post.id}
                post={post}
                onLike={handleLike}
                currentUserId={authUser?.id}
                profileUser={profile}
              />
            ))
          )}
        </div>
      </div>

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

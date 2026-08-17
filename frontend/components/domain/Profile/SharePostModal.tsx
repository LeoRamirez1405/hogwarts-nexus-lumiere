"use client";

import { useEffect, useState } from "react";
import { api, Conversation } from "@/lib/api";
import {
  Avatar,
  Button,
  MaterialIcon,
  Modal,
  BottomSheet,
} from "@/components/ui";
import { hapticLight } from "@/lib/haptics";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface SharedPostMeta {
  id: string;
  author_id: string;
  author_name?: string;
  author_avatar?: string;
  body: string;
  image_url?: string;
  video_url?: string;
  video_poster_url?: string;
  created_at: string;
}

interface SharePostModalProps {
  post: {
    id: string;
    author_id: string;
    author?: { name: string; avatar_url?: string };
    body: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    created_at: string;
  };
  onClose: () => void;
}

export function SharePostModal({ post, onClose }: SharePostModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
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
    video_url: post.video_url,
    video_poster_url: post.video_poster_url,
    created_at: post.created_at,
  };

  const handleSend = async (conv: Conversation) => {
    if (sendingId || sentIds.includes(conv.id)) return;
    hapticLight();
    setSendingId(conv.id);
    try {
      const data = {
        kind: "post" as const,
        body: `Compartio una publicación de ${post.author?.name ?? "un usuario"}`,
        metadata: { post: meta },
      };
      if (conv.type === "room") {
        await api.sendRoomMessage(conv.id, data);
      } else {
        await api.sendMessage({ ...data, receiver_id: conv.id });
      }
      setSentIds((prev) => [...prev, conv.id]);
    } catch (error) {
      console.error("Failed to share post to conversation:", error);
    }
    setSendingId(null);
  };

  const handleNativeShare = async () => {
    hapticLight();
    const url = `${window.location.origin}/profile/${post.author_id}?post=${post.id}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Publicación de ${post.author?.name ?? "un usuario"}`,
          text: post.body.slice(0, 120),
          url,
        });
      } catch (error) {
        console.debug("User cancelled native share:", error);
      }
    } else {
      navigator.clipboard?.writeText(url);
    }
    onClose();
  };

  const filtered = search
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase()),
      )
    : conversations;

  const initialsOf = (name?: string): string =>
    (name ?? "")
      .split(" ")
      .map((n) => n[0])
      .join("");

  const renderBody = () => (
    <>
      {/* Post preview */}
      <div className="pt-1">
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
        <button
          onClick={handleNativeShare}
          className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
        >
          <MaterialIcon name="ios_share" className="text-lg" />
          Compartir fuera de Nexus
        </button>
      </div>

      <div className="mt-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar chat o grupo..."
          className="w-full px-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/40 transition-colors"
        />
      </div>

      <div className="max-h-[45dvh] overflow-y-auto -mx-2 px-2 mt-2 pb-1 no-scrollbar">
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
    </>
  );

  if (isDesktop) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Compartir publicación"
        size="md"
        swipeToDismiss
      >
        {renderBody()}
      </Modal>
    );
  }

  return (
    <BottomSheet open onClose={onClose} title="Compartir publicación">
      {renderBody()}
    </BottomSheet>
  );
}

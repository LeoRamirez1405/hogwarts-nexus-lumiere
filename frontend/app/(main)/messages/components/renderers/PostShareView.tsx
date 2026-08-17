"use client";

import Image from "next/image";
import Link from "next/link";
import { MaterialIcon } from "@/components/ui";
import { mediaSrc } from "@/lib/media";
import { getInitials } from "@/app/(main)/messages/helpers";
import { useShare } from "@/hooks/useShare";
import type { PostShareViewProps } from "./types";

export const PostShareView = ({ message, isOwn }: PostShareViewProps) => {
  const { share } = useShare();
  const post = message.metadata?.post;
  if (!post) return null;

  const initials = getInitials(post.author_name ?? "");
  const shareUrl = `${window.location.origin}/profile/${post.author_id}?post=${post.id}`;

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    share({
      title: `Publicación de ${post.author_name ?? "un usuario"}`,
      text: post.body.slice(0, 120),
      url: shareUrl,
    });
  };

  return (
    <div className="mt-1 rounded-xl overflow-hidden border w-72 max-w-full">
      <Link
        href={`/profile/${post.author_id}`}
        className={`block transition-colors ${
          isOwn ? "bg-white/10 border-white/25 hover:bg-white/15" : "bg-white border-outline-variant/20 hover:bg-surface-container-low"
        }`}
      >
        <div className="p-3">
          <div className="flex items-center gap-2 mb-2">
            {post.author_avatar ? (
              <Image
                src={mediaSrc(post.author_avatar)}
                alt={post.author_name || "Autor"}
                width={28}
                height={28}
                className="w-7 h-7 rounded-full object-cover"
                unoptimized
              />
            ) : (
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  isOwn ? "bg-white/25 text-white" : "bg-primary/10 text-primary"
                }`}
              >
                {initials || "?"}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className={`text-label-sm font-semibold truncate ${isOwn ? "text-white" : "text-on-surface"}`}>
                {post.author_name ?? "Usuario"}
              </p>
              <p className={`text-[10px] ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>Publicación</p>
            </div>
            <MaterialIcon name="article" className={isOwn ? "text-white/60" : "text-on-surface-variant"} />
          </div>
          <p className={`text-body-md wrap-break-word line-clamp-4 ${isOwn ? "text-white/90" : "text-on-surface"}`}>
            {post.body}
          </p>
        </div>
        {post.video_url && (
          <div className="relative bg-black">
            <video
              src={mediaSrc(post.video_url)}
              poster={post.video_poster_url ? mediaSrc(post.video_poster_url) : undefined}
              className="w-full max-h-40 object-cover"
              controls
              playsInline
              preload="metadata"
            />
          </div>
        )}
        {post.image_url && (
          <Image
            src={mediaSrc(post.image_url)}
            alt="Publicación"
            width={288}
            height={160}
            className="w-full h-32 object-cover"
            unoptimized
          />
        )}
      </Link>
      <button
        onClick={handleShare}
        className="w-full px-3 py-2 bg-surface-container-low border-t border-outline-variant/20 flex items-center justify-center gap-2 text-label-sm text-on-surface-variant hover:bg-surface-container-high hover:text-secondary transition-colors"
        aria-label="Compartir publicación"
      >
        <MaterialIcon name="share" className="text-lg" />
        <span className="hidden sm:inline">Compartir</span>
      </button>
    </div>
  );
};
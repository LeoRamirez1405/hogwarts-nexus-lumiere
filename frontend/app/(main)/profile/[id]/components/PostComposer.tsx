"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { User } from "@/lib/api";
import { Avatar, Button, GlassCard, MaterialIcon, MentionInput } from "@/components/ui";
import { useImageUpload } from "@/hooks/useFileUpload";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { toastError } from "@/lib/toastStore";
import { useHapticLight } from "@/hooks/useHapticFeedback";
import { VideoTrimModal } from "@/components/domain/Profile/VideoTrimModal";
import { mediaSrc } from "@/lib/media";

interface PostComposerProps {
  profile: User;
  onCreate: (input: {
    body?: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    video_duration?: number;
  }) => Promise<void>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function PostComposer({ profile, onCreate }: PostComposerProps) {
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const hapticLight = useHapticLight();

  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => {
      setPostImageUrl(result.url);
      video.clear();
    },
  });

  const video = useVideoUpload({
    onReady: () => {
      setPostImageUrl("");
    },
  });

  useEffect(() => {
    if (video.error) toastError(video.error);
  }, [video.error]);

  const handleCreatePost = async () => {
    const hasText = postText.trim().length > 0;
    const hasImage = postImageUrl.trim().length > 0;
    const hasVideo = video.videoUrl.trim().length > 0;
    if ((!hasText && !hasImage && !hasVideo) || posting) return;
    setPosting(true);
    try {
      await onCreate({
        body: hasText ? postText.trim() : undefined,
        image_url: postImageUrl || undefined,
        video_url: video.videoUrl || undefined,
        video_poster_url: video.posterUrl || undefined,
        video_duration: video.duration || undefined,
      });
      setPostText("");
      setPostImageUrl("");
      video.clear();
    } catch (e) {
      toastError("No se pudo publicar", e);
    } finally {
      setPosting(false);
    }
  };

  const mediaBusy = uploadingPostImage || video.uploading;
  const canPublish = postText.trim().length > 0 || postImageUrl.trim().length > 0 || video.videoUrl.trim().length > 0;

  return (
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
          <MentionInput
            value={postText}
            onChange={setPostText}
            placeholder="Qué está pasando en tu mundo mágico?"
            minHeight={80}
            maxHeight={240}
            disabled={posting}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={handlePostImageUpload}
            disabled={uploadingPostImage}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/*"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            disabled={video.uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) video.handleSelectFile(file);
            }}
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
                onClick={() => {
                  hapticLight();
                  setPostImageUrl("");
                }}
                className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>
          )}
          {video.videoUrl && (
            <div className="mt-2 relative rounded-xl overflow-hidden">
              <video
                src={mediaSrc(video.videoUrl)}
                poster={video.posterUrl ? mediaSrc(video.posterUrl) : undefined}
                className="w-full h-40 object-cover rounded-xl bg-black"
                controls
                playsInline
                preload="metadata"
              />
              {video.duration > 0 && (
                <span className="absolute bottom-2 right-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-label-sm font-mono">
                  {formatDuration(video.duration)}
                </span>
              )}
              <button
                onClick={() => {
                  hapticLight();
                  video.clear();
                }}
                className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  hapticLight();
                  fileInputRef.current?.click();
                }}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                  postImageUrl
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-container-high text-on-surface-variant"
                }`}
                title="Adjuntar imagen"
              >
                <MaterialIcon name="image" className="text-xl" />
              </button>
              <button
                onClick={() => {
                  hapticLight();
                  videoInputRef.current?.click();
                }}
                className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                  video.videoUrl
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-surface-container-high text-on-surface-variant"
                }`}
                title="Adjuntar video (máx 30s)"
              >
                <MaterialIcon name="videocam" className="text-xl" />
              </button>
              {mediaBusy && (
                <MaterialIcon
                  name="progress_activity"
                  className="text-lg text-on-surface-variant animate-spin"
                />
              )}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleCreatePost}
              disabled={!canPublish || posting || mediaBusy}
            >
              {posting ? "Publicando..." : "Compartir"}
            </Button>
          </div>
        </div>
      </div>

      {video.pendingFile && (
        <VideoTrimModal
          file={video.pendingFile}
          onCancel={video.cancelTrim}
          onConfirm={video.confirmTrim}
        />
      )}
    </GlassCard>
  );
}
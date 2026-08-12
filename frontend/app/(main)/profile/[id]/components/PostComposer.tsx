"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { User } from "@/lib/api";
import { Avatar, Button, GlassCard, MaterialIcon, MentionInput } from "@/components/ui";
import { useImageUpload } from "@/hooks/useFileUpload";
import { toastError } from "@/lib/toastStore";
import { useHapticLight } from "@/hooks/useHapticFeedback";

interface PostComposerProps {
  profile: User;
  onCreate: (input: { body?: string; image_url?: string }) => Promise<void>;
}

export function PostComposer({ profile, onCreate }: PostComposerProps) {
  const [postText, setPostText] = useState("");
  const [postImageUrl, setPostImageUrl] = useState("");
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hapticLight = useHapticLight();

  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => setPostImageUrl(result.url),
  });

  const handleCreatePost = async () => {
    const hasText = postText.trim().length > 0;
    const hasImage = postImageUrl.trim().length > 0;
    if ((!hasText && !hasImage) || posting) return;
    setPosting(true);
    try {
      await onCreate({
        body: hasText ? postText.trim() : undefined,
        image_url: postImageUrl || undefined,
      });
      setPostText("");
      setPostImageUrl("");
    } catch (e) {
      toastError("No se pudo publicar", e);
    } finally {
      setPosting(false);
    }
  };

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
                onClick={() => { hapticLight(); setPostImageUrl(""); }}
                className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => { hapticLight(); fileInputRef.current?.click(); }}
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
  );
}
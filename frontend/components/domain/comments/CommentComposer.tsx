"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useImageUpload } from "@/hooks/useFileUpload";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { MaterialIcon, MentionInput } from "@/components/ui";
import Image from "next/image";
import { hapticLight } from "@/lib/haptics";
import { VideoTrimModal } from "@/components/domain/Profile/VideoTrimModal";

interface ReplyTarget {
  parentId: string;
  authorName: string;
  preview: string;
}

interface CommentComposerProps {
  placeholder: string;
  replyTarget?: ReplyTarget | null;
  onCancelReply: () => void;
  onSubmit: (input: {
    body: string;
    image_url?: string;
    video_url?: string;
    video_poster_url?: string;
    video_duration?: number;
  }) => Promise<void>;
  posting: boolean;
  composerInputRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function CommentComposer({
  placeholder,
  replyTarget,
  onCancelReply,
  onSubmit,
  posting,
  composerInputRef,
}: CommentComposerProps) {
  const [commentText, setCommentText] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const { handleFileSelect: handlePostImageUpload, uploading: uploadingPostImage } = useImageUpload({
    onSuccess: (result) => {
      setImageUrl(result.url);
      video.clear();
    },
  });

  const video = useVideoUpload({
    onReady: () => {
      setImageUrl("");
    },
  });

  useEffect(() => {
    if (video.error) {
      console.error(video.error);
    }
  }, [video.error]);

  const handleCreateComment = useCallback(async () => {
    const hasText = commentText.trim().length > 0;
    const hasImage = imageUrl.trim().length > 0;
    const hasVideo = video.videoUrl.trim().length > 0;
    if ((!hasText && !hasImage && !hasVideo) || posting || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit({
        body: hasText ? commentText.trim() : "",
        image_url: imageUrl || undefined,
        video_url: video.videoUrl || undefined,
        video_poster_url: video.posterUrl || undefined,
        video_duration: video.duration || undefined,
      });
      setCommentText("");
      setImageUrl("");
      video.clear();
    } catch (e) {
      console.error("Failed to post comment:", e);
    } finally {
      setSubmitting(false);
    }
  }, [commentText, imageUrl, video, onSubmit, posting, submitting]);

  const mediaBusy = uploadingPostImage || video.uploading;
  const canPublish = commentText.trim().length > 0 || imageUrl.trim().length > 0 || video.videoUrl.trim().length > 0;

  return (
    <>
      {replyTarget && (
        <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
          <MaterialIcon name="reply" className="text-primary text-lg shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-label-sm font-medium text-primary">
              Respondiendo a {replyTarget.authorName}
            </p>
            <p className="text-label-sm text-on-surface-variant truncate">
              {replyTarget.preview}
            </p>
          </div>
          <button
            onClick={onCancelReply}
            className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            aria-label="Cancelar respuesta"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}
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
      <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-3 md:px-4 py-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              hapticLight();
              fileInputRef.current?.click();
            }}
            className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
              imageUrl
                ? "bg-primary/10 text-primary"
                : "hover:bg-surface-container-high text-on-surface-variant"
            }`}
            title="Adjuntar imagen"
            disabled={uploadingPostImage || video.uploading}
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
            disabled={uploadingPostImage || video.uploading}
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
        <div className="relative flex-1 ml-2">
          <MentionInput
            ref={composerInputRef}
            value={commentText}
            onChange={setCommentText}
            placeholder={placeholder}
            minHeight={40}
            maxHeight={120}
            disabled={posting}
            onSubmit={handleCreateComment}
            rows={1}
            textareaClassName="block w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50 resize-none min-h-[2.5rem] max-h-[8rem] leading-6 py-2"
          />
        </div>
        <button
          onClick={handleCreateComment}
          disabled={!canPublish || posting || mediaBusy}
          className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Enviar comentario"
        >
          <MaterialIcon name="send" className="text-lg" />
        </button>
      </div>
      {(imageUrl || video.videoUrl) && (
        <div className="mt-2 flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
          {imageUrl && (
            <>
              <MaterialIcon name="image" className="text-lg text-primary" />
              <Image
                src={imageUrl}
                alt="Preview"
                width={64}
                height={64}
                className="w-16 h-16 object-cover rounded-md"
                unoptimized
              />
            </>
          )}
          {video.videoUrl && (
            <>
              <MaterialIcon name="videocam" className="text-lg text-primary" />
              <video
                src={video.videoUrl}
                poster={video.posterUrl}
                className="w-16 h-16 object-cover rounded-md"
                muted
                preload="metadata"
              />
            </>
          )}
          <button
            onClick={() => {
              hapticLight();
              setImageUrl("");
              video.clear();
            }}
            className="ml-auto p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            aria-label="Quitar adjunto"
          >
            <MaterialIcon name="close" className="text-lg" />
          </button>
        </div>
      )}
      {mediaBusy && (
        <div className="mt-2 text-center text-label-sm text-on-surface-variant">
          <MaterialIcon
            name="progress_activity"
            className="text-lg text-on-surface-variant animate-spin inline-block mb-1"
          />
          Subiendo...
        </div>
      )}
      {video.pendingFile && (
        <VideoTrimModal
          file={video.pendingFile}
          onCancel={video.cancelTrim}
          onConfirm={video.confirmTrim}
        />
      )}
    </>
  );
}
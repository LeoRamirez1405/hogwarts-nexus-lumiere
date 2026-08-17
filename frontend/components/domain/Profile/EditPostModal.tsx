"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import { api, Post } from "@/lib/api";
import { mediaSrc } from "@/lib/media";
import { Modal, Button, MaterialIcon } from "@/components/ui";
import { useVideoUpload } from "@/hooks/useVideoUpload";
import { toastError } from "@/lib/toastStore";
import { VideoTrimModal } from "./VideoTrimModal";

interface EditPostModalProps {
  post: Post;
  onClose: () => void;
  onSaved?: (updated: Post) => void;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export const EditPostModal = memo(function EditPostModal({
  post,
  onClose,
  onSaved,
}: EditPostModalProps) {
  const [editText, setEditText] = useState(post.body);
  const [editImageUrl, setEditImageUrl] = useState(post.image_url ?? "");
  const [saving, setSaving] = useState(false);

  const video = useVideoUpload();

  useEffect(() => {
    if (video.error) toastError(video.error);
  }, [video.error]);

  const handleSave = async () => {
    const text = editText.trim();
    const image = editImageUrl.trim();
    const clip = video.videoUrl.trim();
    if ((!text && !image && !clip) || saving) return;
    setSaving(true);
    try {
      const updated = await api.updatePost(post.id, {
        body: text || undefined,
        image_url: image || undefined,
        video_url: clip || undefined,
        video_poster_url: video.posterUrl || undefined,
        video_duration: video.duration || undefined,
      });
      onSaved?.(updated);
      onClose();
    } catch (e) {
      toastError("No se pudo editar la publicación", e);
    } finally {
      setSaving(false);
    }
  };

  const replacingImage = editImageUrl.trim().length > 0;
  const currentVideo = post.video_url && !video.videoUrl && !video.pendingFile
    ? post.video_url
    : video.videoUrl;
  const currentPoster = video.posterUrl || (post.video_poster_url && !video.videoUrl && !video.pendingFile ? post.video_poster_url : undefined);
  const currentDuration = video.duration || post.video_duration || 0;

  return (
    <Modal
      open
      onClose={() => !saving && onClose()}
      title="Editar publicación"
      size="md"
    >
      <div className="space-y-4">
        <textarea
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          placeholder="Que esta pasando en tu mundo magico?"
          className="w-full bg-surface-container-low rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none resize-none border border-outline-variant/20 focus:border-primary/40 transition-colors min-h-28"
          autoFocus
        />
        {replacingImage && (
          <div className="relative rounded-xl overflow-hidden">
            <Image
              src={mediaSrc(editImageUrl)}
              alt="Preview"
              width={400}
              height={250}
              className="w-full h-40 object-cover rounded-xl"
              unoptimized
            />
            <button
              onClick={() => setEditImageUrl("")}
              className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label="Quitar imagen"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        )}
        {currentVideo && (
          <div className="relative rounded-xl overflow-hidden">
            <video
              src={mediaSrc(currentVideo)}
              poster={currentPoster ? mediaSrc(currentPoster) : undefined}
              className="w-full h-40 object-cover rounded-xl bg-black"
              controls
              playsInline
              preload="metadata"
            />
            {currentDuration > 0 && (
              <span className="absolute bottom-2 right-10 px-2 py-0.5 rounded-full bg-black/70 text-white text-label-sm font-mono">
                {formatDuration(currentDuration)}
              </span>
            )}
            <button
              onClick={() => video.clear()}
              className="absolute top-2 right-2 w-7 h-7 inline-flex items-center justify-center bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
              aria-label="Quitar video"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        )}
        {!currentVideo && !replacingImage && (
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="video/*"
              className="hidden"
              id="edit-post-video-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) video.handleSelectFile(file);
              }}
            />
            <button
              onClick={() => document.getElementById("edit-post-video-input")?.click()}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-outline-variant/30 text-label-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
            >
              <MaterialIcon name="videocam" className="text-lg" />
              {video.uploading ? "Subiendo..." : "Adjuntar video (máx 30s)"}
            </button>
            {!replacingImage && (
              <button
                onClick={() => document.getElementById("edit-post-image-input")?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-outline-variant/30 text-label-sm text-on-surface-variant hover:bg-surface-container-low hover:text-primary transition-colors"
              >
                <MaterialIcon name="image" className="text-lg" />
                Adjuntar imagen
              </button>
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="edit-post-image-input"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                const result = await api.uploadFile(file).catch(() => null);
                if (result?.url) {
                  setEditImageUrl(result.url);
                  video.clear();
                }
              }}
            />
          </div>
        )}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="check"
            onClick={handleSave}
            disabled={
              (!editText.trim() && !editImageUrl.trim() && !video.videoUrl.trim()) ||
              saving ||
              video.uploading
            }
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      {video.pendingFile && (
        <VideoTrimModal
          file={video.pendingFile}
          onCancel={video.cancelTrim}
          onConfirm={video.confirmTrim}
        />
      )}
    </Modal>
  );
});
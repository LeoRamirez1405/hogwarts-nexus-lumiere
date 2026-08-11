"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { api, Message } from "@/lib/api";
import { MaterialIcon } from "../helpers";
import { BottomSheet } from "@/components/ui";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface MediaGalleryModalProps {
  convId: string;
  convType: "dm" | "room";
  convName: string;
  onClose: () => void;
}

const KIND_ICONS: Record<string, { icon: string; colorClass: string }> = {
  image: { icon: "image", colorClass: "text-primary" },
  video: { icon: "video_library", colorClass: "text-secondary" },
  document: { icon: "description", colorClass: "text-primary" },
  audio: { icon: "music_note", colorClass: "text-secondary" },
  voice: { icon: "mic", colorClass: "text-secondary" },
  sticker: { icon: "emoji_emotions", colorClass: "text-secondary" },
};

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaGalleryModal({
  convId,
  convType,
  convName,
  onClose,
}: MediaGalleryModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
  const [mediaItems, setMediaItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMedia, setSelectedMedia] = useState<Message | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let cancelled = false;

    const loadMedia = async () => {
      setLoading(true);
      try {
        const items = convType === "room"
          ? await api.getRoomMedia(convId, 200)
          : await api.getDmMedia(convId, 200);
        if (!cancelled) {
          setMediaItems(items);
        }
      } catch (err) {
        console.error("Failed to load media", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMedia();

    return () => { cancelled = true; };
  }, [convId, convType]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = "none";
    e.currentTarget.nextElementSibling?.classList.remove("hidden");
  };

  const handleVideoError = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    e.currentTarget.style.display = "none";
    e.currentTarget.nextElementSibling?.classList.remove("hidden");
  };

  const handleClickItem = (item: Message) => {
    if (item.kind === "image" || item.kind === "video") {
      setSelectedMedia(item);
    }
  };

  const handleCloseViewer = () => {
    setSelectedMedia(null);
  };

  const renderHeader = () => (
    <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
      <div className="flex items-center gap-3">
        <button
          onClick={onClose}
          className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
          aria-label="Cerrar galería"
        >
          <MaterialIcon name="close" className="text-xl" />
        </button>
        <div>
          <h2 className="font-display text-title-md text-on-surface">Multimedia</h2>
          <p className="text-label-sm text-on-surface-variant">{convName}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-label-sm text-on-surface-variant">
          {mediaItems.length} elementos
        </span>
        <button
          onClick={() => setViewMode("grid")}
          className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${viewMode === "grid" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
          aria-label="Vista cuadrícula"
        >
          <MaterialIcon name="grid_view" className="text-xl" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${viewMode === "list" ? "bg-primary text-on-primary" : "text-on-surface-variant hover:bg-surface-container-high"}`}
          aria-label="Vista lista"
        >
          <MaterialIcon name="view_list" className="text-xl" />
        </button>
      </div>
    </div>
  );

  const renderContent = () => (
    <div
      className={isDesktop ? "flex-1 overflow-y-auto p-4" : "p-4"}
      role="region"
      aria-label="Galería de multimedia"
    >
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin" />
        </div>
      ) : mediaItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center px-8">
          <MaterialIcon name="photo_library" className="text-6xl text-outline-variant mb-4" />
          <h3 className="font-display text-title-lg text-on-surface mb-1">Sin multimedia</h3>
          <p className="text-on-surface-variant text-body-md">
            Esta conversación no tiene imágenes, videos ni documentos compartidos.
          </p>
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
          {mediaItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClickItem(item)}
              className="aspect-square rounded-lg overflow-hidden bg-surface-container-high relative group focus:outline-none focus:ring-2 focus:ring-primary"
              aria-label={`${KIND_ICONS[item.kind]?.icon || "Archivo"} ${item.body || item.attachment_name || "sin nombre"}`}
            >
              {item.kind === "image" && item.attachment_url && (
                <>
                  <Image
                    src={item.attachment_url}
                    alt={item.body || item.attachment_name || "Imagen"}
                    fill
                    unoptimized
                    className="object-cover transition-transform duration-200 group-hover:scale-105"
                    onError={handleImageError}
                  />
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-surface-container-high">
                    <MaterialIcon name="broken_image" className="text-3xl text-on-surface-variant" />
                  </div>
                </>
              )}
              {item.kind === "video" && item.attachment_url && (
                <>
                  <video
                    src={item.attachment_url}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    muted
                    preload="metadata"
                    onError={handleVideoError}
                  />
                  <div className="hidden absolute inset-0 flex items-center justify-center bg-surface-container-high">
                    <MaterialIcon name="broken_image" className="text-3xl text-on-surface-variant" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                    <MaterialIcon name="play_circle" className="text-white text-3xl" />
                  </div>
                </>
              )}
              {item.kind === "document" && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                  <MaterialIcon name={KIND_ICONS.document.icon} className={`text-4xl ${KIND_ICONS.document.colorClass}`} />
                  <span className="text-label-sm text-on-surface-variant truncate w-full px-2">
                    {item.attachment_name || "Documento"}
                  </span>
                </div>
              )}
              {item.kind === "audio" && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                  <MaterialIcon name={KIND_ICONS.audio.icon} className={`text-4xl ${KIND_ICONS.audio.colorClass}`} />
                  <span className="text-label-sm text-on-surface-variant truncate w-full px-2">
                    {item.attachment_name || "Audio"}
                  </span>
                </div>
              )}
              {item.kind === "voice" && (
                <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center gap-2">
                  <MaterialIcon name={KIND_ICONS.voice.icon} className={`text-4xl ${KIND_ICONS.voice.colorClass}`} />
                  <span className="text-label-sm text-on-surface-variant">Nota de voz</span>
                </div>
              )}
              {item.kind === "sticker" && (
                <div className="w-full h-full flex items-center justify-center bg-surface-container">
                  <span className="text-5xl">{item.body}</span>
                </div>
              )}

              {/* Type badge */}
              <div className="absolute bottom-1 left-1 right-1 flex justify-between p-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                  {KIND_ICONS[item.kind]?.icon ?? "insert_drive_file"}
                </span>
                {item.metadata?.file_size ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white">
                    {formatFileSize(item.metadata.file_size as number)}
                  </span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-1 max-h-full">
          {mediaItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleClickItem(item)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-container-high transition-colors focus:outline-none focus:ring-2 focus:ring-primary text-left"
              aria-label={`${KIND_ICONS[item.kind]?.icon || "Archivo"} ${item.body || item.attachment_name || "sin nombre"}`}
            >
              <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-surface-container-high relative">
                {item.kind === "image" && item.attachment_url && (
                  <Image
                    src={item.attachment_url}
                    alt=""
                    fill
                    unoptimized
                    className="object-cover"
                    onError={handleImageError}
                  />
                )}
                {item.kind === "video" && item.attachment_url && (
                  <video src={item.attachment_url} className="w-full h-full object-cover" muted preload="metadata" onError={handleVideoError} />
                )}
                {(item.kind === "document" || item.kind === "audio" || item.kind === "voice") && (
                  <div className="w-full h-full flex items-center justify-center">
                    <MaterialIcon name={KIND_ICONS[item.kind]?.icon || "insert_drive_file"} className={`text-2xl ${KIND_ICONS[item.kind]?.colorClass || ""}`} />
                  </div>
                )}
                {item.kind === "sticker" && item.body && (
                  <span className="text-2xl">{item.body}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md text-on-surface truncate">
                  {item.body || item.attachment_name || "Sin nombre"}
                </p>
                <p className="text-label-sm text-on-surface-variant flex items-center gap-1">
                  <span>{new Date(item.created_at).toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                  {item.metadata?.file_size ? <span>· {formatFileSize(item.metadata.file_size as number)}</span> : null}
                </p>
              </div>
              <MaterialIcon name="chevron_right" className="text-on-surface-variant text-xl" />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const renderViewer = () =>
    selectedMedia &&
    createPortal(
      <div
        className="fixed inset-0 z-[70] flex items-center justify-center bg-black/95"
        onClick={handleCloseViewer}
        role="dialog"
        aria-modal="true"
        aria-label="Visor de multimedia"
      >
        <button
          onClick={(e) => { e.stopPropagation(); handleCloseViewer(); }}
          className="absolute top-4 right-4 w-12 h-12 inline-flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          aria-label="Cerrar visor"
        >
          <MaterialIcon name="close" className="text-2xl" />
        </button>
        {selectedMedia.kind === "image" && selectedMedia.attachment_url && (
          <Image
            src={selectedMedia.attachment_url}
            alt={selectedMedia.body || "Imagen"}
            className="max-w-[90vw] max-h-[90vh] object-contain"
            unoptimized
            priority
          />
        )}
        {selectedMedia.kind === "video" && selectedMedia.attachment_url && (
          <video
            src={selectedMedia.attachment_url}
            className="max-w-[90vw] max-h-[90vh]"
            controls
            autoPlay
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>,
      document.body
    );

  if (isDesktop) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />

        <div className="relative w-full max-w-5xl h-[90vh] max-h-[90vh] bg-surface rounded-2xl overflow-hidden flex flex-col">
          {renderHeader()}
          {renderContent()}
        </div>

        {renderViewer()}
      </div>,
      document.body
    );
  }

  return (
    <>
      <BottomSheet open onClose={onClose} title="Multimedia" showTitle={false}>
        {renderHeader()}
        <div className="pb-2">{renderContent()}</div>
      </BottomSheet>
      {renderViewer()}
    </>
  );
}
"use client";

import { useState, useEffect, useRef, memo } from "react";
import { MaterialIcon } from "@/components/ui";
import { formatMessageTime, parseUtc } from "@/app/(main)/messages/helpers";
import { ReplyPreview } from "./ReplyPreview";
import { PollView } from "./PollView";
import { PostShareView } from "./PostShareView";
import { StickerView } from "./StickerView";
import { VoiceView } from "./VoiceView";
import { DocumentView } from "./DocumentView";
import { ImageView } from "./ImageView";
import { VideoView } from "./VideoView";
import { AudioView } from "./AudioView";
import { MentionText } from "./MentionText";
import { ReactionBar } from "./ReactionBar";
import { MessageActions } from "./MessageActions";
import { EditMessageForm } from "./EditMessageForm";
import { LinkPreviewView } from "./LinkPreviewView";
import { detectMessageEffect, MessageEffectBurst } from "@/components/ui/MessageEffects";
import type { MessageBubbleProps } from "./types";

const formatDisappearTime = (disappearAt: string) => {
  const diff = parseUtc(disappearAt).getTime() - Date.now();
  if (diff <= 0) return "Expirado";
  const totalSeconds = Math.max(1, Math.ceil(diff / 1000));
  // Cuenta atras estilo Telegram: mm:ss cuando queda menos de una hora.
  if (totalSeconds < 3600) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }
  const hours = Math.ceil(totalSeconds / 3600);
  if (hours < 24) return `${hours}h`;
  const days = Math.ceil(hours / 24);
  return `${days}d`;
};

const SWIPE_TRIGGER = 90;
const SWIPE_MAX = 120;

export const MessageBubble = memo(
  ({
    message,
    isOwn,
    onReply,
    onReactionChange,
    onScrollToMessage,
    onTogglePin,
    onToggleStar,
    onForward,
    onEdit,
    onDelete,
    onPollVote,
    members,
    isReplyTarget,
    editing,
    onSaveEdit,
    onCancelEdit,
  }: MessageBubbleProps) => {
  const [dataSaver] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("nexus-data-saver") === "true";
    }
    return false;
  });
  const [loadMedia, setLoadMedia] = useState<string | null>(null);
  const [disappearTime, setDisappearTime] = useState("");
  const [actionsOpen, setActionsOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [showEffect, setShowEffect] = useState(false);
  const effectType = detectMessageEffect(message.body || "");
  const dragXRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const kind = message.kind || "text";

  // Find sender info from members for group chats
  const sender = members?.find((m) => m.user_id === message.sender_id);
  const senderName = sender?.user?.name || "Desconocido";
  const isGroup = members && members.length > 0;

  useEffect(() => {
    if (!message.disappear_at) return;
    const update = () => setDisappearTime(formatDisappearTime(message.disappear_at!));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [message.disappear_at]);

  useEffect(() => {
    if (effectType && !message.optimistic) {
      setShowEffect(true);
      const timer = setTimeout(() => setShowEffect(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [effectType, message.optimistic, message.id]);

  const shouldLoadMedia = (url: string) => {
    if (!dataSaver) return true;
    return loadMedia === url;
  };

  // ===== Swipe estilo Telegram: la burbuja sigue al dedo =====
  // Mensajes propios (derecha): swipe hacia la izquierda (negativo)
  // Mensajes ajenos (izquierda): swipe hacia la derecha (positivo)
  const swipeDir = isOwn ? -1 : 1;

  // Urgencia del temporizador de desaparicion: rojo < 1 min, dorado < 5 min.
  const disappearDiff = message.disappear_at
    ? parseUtc(message.disappear_at).getTime() - Date.now()
    : null;
  const disappearUrgent = disappearDiff !== null && disappearDiff <= 60_000;
  const disappearWarn =
    disappearDiff !== null && !disappearUrgent && disappearDiff <= 300_000;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (message.optimistic || editing || message.deleting) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const dx = e.touches[0].clientX - touchStartRef.current.x;
    const dy = e.touches[0].clientY - touchStartRef.current.y;
    // Solo horizontal dominante
    if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      movedRef.current = true;
      setDragging(true);
      const raw = swipeDir < 0 ? Math.min(0, dx) : Math.max(0, dx);
      const next = swipeDir < 0 ? Math.max(raw, -SWIPE_MAX) : Math.min(raw, SWIPE_MAX);
      dragXRef.current = next;
      setDragX(next);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    touchStartRef.current = null;
    if (Math.abs(dragXRef.current) >= SWIPE_TRIGGER) {
      onReply?.(message);
    }
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  const handleTouchCancel = () => {
    touchStartRef.current = null;
    dragXRef.current = 0;
    setDragX(0);
    setDragging(false);
  };

  // ===== Tap en la burbuja: abre/cierra las acciones =====
  // Se ignora si el toque fue un drag (swipe) o si apuntó a un elemento
  // interactivo (links, botones, medios...).
  const handleBubbleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    const target = e.target as HTMLElement;
    if (
      target.closest(
        "a, button, [role='button'], input, textarea, select, label, video, audio"
      )
    ) {
      return;
    }
    setActionsOpen((v) => !v);
  };

return (
    <div
      id={`msg-${message.id}`}
      ref={anchorRef}
      className={`relative flex ${isOwn ? "justify-end" : "justify-start"} mb-3 gap-2 group ${
        message.optimistic ? "opacity-75" : ""
      } ${dragging ? "select-none" : ""} ${
        message.deleting ? "message-deleting" : ""
      } transition-transform ${
        dragging ? "" : "duration-200 ease-out"
      }`}
      style={{ transform: `translateX(${dragX}px)`, touchAction: "pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseEnter={() => setActionsOpen(true)}
    >
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" />
        </div>
      )}

      {/* Botón "Responder" revelado por el swipe (estilo Telegram) */}
      {!message.optimistic && dragging && (
        <button
          type="button"
          onClick={() => {
            if (movedRef.current) {
              movedRef.current = false;
              return;
            }
            onReply?.(message);
          }}
          className={`absolute top-1/2 -translate-y-1/2 z-[90] w-9 h-9 flex items-center justify-center rounded-full glass-card shadow-lg text-primary ${
            isOwn ? "right-2" : "left-2"
          }`}
          style={{ opacity: Math.min(1, Math.abs(dragX) / SWIPE_TRIGGER) }}
          aria-label="Responder"
          title="Responder"
        >
          <MaterialIcon name="reply" className="text-lg" />
        </button>
      )}

      <div className={`relative flex flex-col ${kind.startsWith("video") ? "max-w-[80%]" : "max-w-[70%]"}`}>
        {!message.optimistic && !editing && (
          <MessageActions
            message={message}
            isOwn={isOwn}
            open={actionsOpen}
            onOpenChange={setActionsOpen}
            onReply={onReply}
            onTogglePin={onTogglePin}
            onToggleStar={onToggleStar}
            onForward={onForward}
            onEdit={onEdit}
            onDelete={onDelete}
            onReactionChange={onReactionChange}
            anchorRef={bubbleRef}
          />
        )}
        <div
          ref={bubbleRef}
          onClick={handleBubbleClick}
          className={`px-4 py-2.5 cursor-pointer ${
            isOwn
              ? "bg-primary text-white rounded-2xl rounded-tr-none"
              : "bg-secondary-container text-on-secondary-container rounded-2xl rounded-tl-none"
          } ${
            isReplyTarget
              ? isOwn
                ? "ring-2 ring-white/70"
                : "ring-2 ring-secondary/60"
              : ""
          }`}
        >
          <ReplyPreview message={message} onScrollToMessage={onScrollToMessage} />

          {message.forwarded && (
            <div
              className={`flex items-center gap-1 text-[10px] mb-1 ${isOwn ? "text-white/70" : "text-on-secondary-container/70"}`}
              title="Mensaje reenviado"
            >
              <MaterialIcon name="forward" className="text-[11px]" />
              <span>Reenviado</span>
            </div>
          )}

          {isGroup && !isOwn && (
            <div className="px-1 text-xs font-medium text-on-secondary-container/70 mb-1" aria-hidden="true">
              {senderName}
            </div>
          )}

          {kind === "poll" && message.poll && (
            <PollView
              poll={message.poll}
              isOwn={isOwn}
              messageId={message.id}
              onVoteChange={onPollVote}
            />
          )}
          {kind === "post" && <PostShareView message={message} isOwn={isOwn} />}
          {kind === "sticker" && message.body && <StickerView sticker={message.body} />}
          {kind === "voice" && message.attachment_url && <VoiceView message={message} isOwn={isOwn} />}
          {kind === "document" && message.attachment_url && <DocumentView message={message} isOwn={isOwn} />}

          {editing && kind === "text" ? (
            <EditMessageForm
              body={message.body || ""}
              isOwn={isOwn}
              onSave={(body) => onSaveEdit?.(message.id, body)}
              onCancel={onCancelEdit ?? (() => {})}
            />
          ) : (kind === "text" || kind === "image" || kind === "video" || kind === "audio") && message.body && (
            <div className="text-body-md wrap-break-word">
              <MentionText text={message.body} isOwn={isOwn} members={members} />
            </div>
          )}

          {message.metadata?.link_preview && (
            <LinkPreviewView
              preview={message.metadata.link_preview}
              isOwn={isOwn}
            />
          )}

          {message.attachment_url && ["image", "video", "audio"].some((t) => kind.startsWith(t)) && (
            <div className="mt-2">
              {dataSaver && !shouldLoadMedia(message.attachment_url!) ? (
                kind.startsWith("image") ? (
                  <ImageView
                    url={message.attachment_url!}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                ) : kind.startsWith("video") ? (
                  <VideoView
                    message={message}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                ) : (
                  <AudioView
                    url={message.attachment_url!}
                    isOwn={isOwn}
                    dataSaver={dataSaver}
                    shouldLoad={false}
                    onLoadClick={() => setLoadMedia(message.attachment_url!)}
                  />
                )
              ) : kind.startsWith("image") ? (
                <ImageView url={message.attachment_url!} isOwn={isOwn} />
              ) : kind.startsWith("video") ? (
                <VideoView message={message} isOwn={isOwn} />
              ) : kind.startsWith("audio") ? (
                <AudioView url={message.attachment_url!} isOwn={isOwn} />
              ) : null}
            </div>
          )}

          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "text-white/60" : "text-on-secondary-container/70"}`}>
            {message.pinned && <MaterialIcon name="push_pin" className="text-[11px]" filled />}
            {message.optimistic && message.sending && (
              <span className="flex items-center gap-0.5 text-[10px]" title="Enviando...">
                <MaterialIcon name="progress_activity" className="text-[10px] animate-spin" />
                <span>Enviando...</span>
              </span>
            )}
            {message.edited && !message.optimistic && (
              <span
                className="text-[10px]"
                title={
                  message.edited_at
                    ? `Editado ${new Date(message.edited_at).toLocaleString()}`
                    : "Editado"
                }
              >
                Editado
              </span>
            )}
            {message.optimistic && message.failed && (
              <span className="flex items-center gap-0.5 text-[10px]" title="Error de envío, se reintentará automáticamente">
                <MaterialIcon name="error" className="text-[10px]" />
                <span>No enviado</span>
              </span>
            )}
            {isOwn && !message.optimistic && !message.room_id && message.read && (
              <span className="flex items-center" title="Leído">
                <MaterialIcon name="done_all" className="text-[12px]" filled />
              </span>
            )}
            {isOwn && !message.optimistic && !message.room_id && !message.read && (
              <span className="flex items-center" title="Entregado">
                <MaterialIcon name="check" className="text-[12px]" />
              </span>
            )}
            {message.disappear_at && !message.deleting ? (
              <span
                className={`flex items-center gap-1 rounded-full px-1.5 py-[2px] backdrop-blur-sm select-none ${
                  disappearUrgent ? "animate-disappear-pulse" : ""
                }`}
                style={{
                  backgroundColor: "rgba(0, 0, 0, 0.55)",
                  color: disappearUrgent
                    ? "var(--color-error-container)"
                    : disappearWarn
                      ? "var(--color-secondary-fixed)"
                      : "rgba(255, 255, 255, 0.92)",
                }}
                title={`Este mensaje desaparece ${parseUtc(
                  message.disappear_at
                ).toLocaleString()}`}
              >
                <MaterialIcon name="timer" className="text-[10px]" />
                <span className="text-[10px] leading-none">{disappearTime || "..."}</span>
              </span>
            ) : (
              <p className="text-[10px]">{formatMessageTime(message.created_at)}</p>
            )}
          </div>
        </div>

        {showEffect && effectType && (
          <MessageEffectBurst
            type={effectType}
            triggerRef={bubbleRef}
            onComplete={() => setShowEffect(false)}
          />
        )}

        {message.reactions && message.reactions.length > 0 && (
          <ReactionBar reactions={message.reactions} messageId={message.id} onReacted={onReactionChange} />
        )}
      </div>

      {isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" filled />
        </div>
      )}
    </div>
  );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.isOwn === next.isOwn &&
    prev.isReplyTarget === next.isReplyTarget &&
    prev.members === next.members &&
    prev.editing === next.editing
);

MessageBubble.displayName = "MessageBubble";

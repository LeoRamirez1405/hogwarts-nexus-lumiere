"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { Message, MessageReaction, ChatRoomMemberResponse } from "@/lib/api";
import { mediaSrc } from "@/lib/media";
import { useAuthStore } from "@/lib/authStore";
import {
  MaterialIcon,
  formatMessageTime,
  getFileIcon,
  formatFileSize,
  STICKER_PACKS,
} from "./helpers";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const PollView = React.memo(function PollView({
  poll,
  isOwn,
}: {
  poll: Message["poll"];
  isOwn: boolean;
}) {
  if (!poll) return null;

  const totalVotes = poll.total_votes;

  return (
    <div
      className={`mt-2 p-3 rounded-xl border ${
        isOwn
          ? "bg-white/10 border-white/20"
          : "bg-white border-outline-variant/30"
      }`}
    >
      <p className={`text-body-md font-semibold mb-2 ${isOwn ? "text-white" : "text-on-surface"}`}>
        {poll.question}
      </p>
      <div className="space-y-1.5">
        {poll.options.map((opt) => {
          const pct = totalVotes > 0 ? (opt.votes_count / totalVotes) * 100 : 0;
          return (
            <div key={opt.id} className="flex items-center gap-2">
              <div
                className={`flex-1 h-8 rounded-full transition-all overflow-hidden ${
                  opt.voted_by_me
                    ? isOwn ? "bg-white/25" : "bg-primary"
                    : isOwn ? "bg-white/10" : "bg-surface-container-high"
                }`}
                style={{ width: `${Math.max(pct, 8)}%`, minWidth: "60px" }}
              >
                <span
                  className={`flex items-center justify-end pr-2 text-label-sm h-full font-medium ${
                    opt.voted_by_me
                      ? isOwn ? "text-white" : "text-on-primary"
                      : isOwn ? "text-white/80" : "text-on-surface"
                  }`}
                >
                  {opt.label}
                </span>
              </div>
              <div className={`w-16 text-right text-label-sm font-medium ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
                {opt.votes_count}{" "}
                {totalVotes > 0 ? `(${Math.round(pct)}%)` : ""}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`flex items-center justify-between mt-3 pt-2 border-t ${isOwn ? "border-white/20" : "border-outline-variant/30"}`}>
        <span className={`text-label-sm font-medium ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
          {totalVotes} voto{totalVotes !== 1 ? "s" : ""}
        </span>
        {poll.multi_choice && (
          <span className={`text-label-sm font-medium ${isOwn ? "text-white/80" : "text-primary"}`}>
            Multiple opcion
          </span>
        )}
      </div>
    </div>
  );
});

export const StickerView = React.memo(function StickerView({ sticker }: { sticker: string }) {
  return (
    <div className="text-6xl select-none" style={{ lineHeight: 1 }}>
      {sticker}
    </div>
  );
});

export const VoiceView = React.memo(function VoiceView({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const transcription = message.metadata?.transcription;

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    if (!message.attachment_url) return;
    const audio = new Audio(message.attachment_url);
    audioRef.current = audio;
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onended = () => setPlaying(false);
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [message.attachment_url]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-xl ${
        isOwn ? "bg-white/15" : "bg-surface-container-high border border-outline-variant/20"
      }`}
    >
      <button
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
          isOwn
            ? "bg-white text-primary"
            : "bg-primary text-on-primary"
        }`}
        aria-label={playing ? "Pausar" : "Reproducir"}
      >
        <MaterialIcon
          name={playing ? "pause" : "play_arrow"}
          className="text-xl"
        />
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-2 rounded-full relative overflow-hidden ${isOwn ? "bg-white/20" : "bg-surface-container-highest"}`}>
            <div
              className={`h-full rounded-full transition-all ${isOwn ? "bg-white/70" : "bg-primary/60"}`}
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />
          </div>
          <span className={`text-label-sm font-mono w-12 text-right ${isOwn ? "text-white/80" : "text-on-surface-variant"}`}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>
        {transcription && (
          <p className={`text-label-sm mt-1 italic max-h-16 overflow-hidden text-ellipsis ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>
            {transcription}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {transcription && (
          <button
            className={`p-1 rounded-full transition-colors ${isOwn ? "hover:bg-white/20 text-white/70" : "hover:bg-surface-container-highest text-on-surface-variant"}`}
            title="Copiar transcripcion"
          >
            <MaterialIcon name="content_copy" className="text-lg" />
          </button>
        )}
        <a
          href={message.attachment_url}
          download
          className={`p-1 rounded-full transition-colors ${isOwn ? "hover:bg-white/20 text-white/70" : "hover:bg-surface-container-highest text-on-surface-variant"}`}
        >
          <MaterialIcon name="download" className="text-lg" />
        </a>
      </div>
    </div>
  );
});

export const DocumentView = React.memo(function DocumentView({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const icon = getFileIcon(message.attachment_type || "");
  const name = message.attachment_name || "Documento";
  const size = message.metadata?.size
    ? formatFileSize(message.metadata.size)
    : "";

  return (
    <a
      href={message.attachment_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 rounded-xl border w-fit ${
        isOwn
          ? "bg-white/15 border-white/20"
          : "bg-white border-outline-variant/20"
      }`}
    >
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 ${
          isOwn
            ? "bg-white/20 text-white"
            : "bg-primary/10 text-primary"
        }`}
      >
        <MaterialIcon name={icon} className="text-2xl" />
      </div>
      <div className="min-w-0">
        <p className={`text-body-md truncate max-w-xs ${isOwn ? "text-white" : "text-on-surface"}`}>{name}</p>
        <p className={`text-label-sm ${isOwn ? "text-white/70" : "text-on-surface-variant"}`}>{size}</p>
      </div>
      <MaterialIcon name="open_in_new" className={isOwn ? "text-white/70" : "text-on-surface-variant"} />
    </a>
  );
});

export const PostShareView = React.memo(function PostShareView({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  const post = message.metadata?.post;
  if (!post) return null;

  const initials = (post.author_name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <Link
      href={`/profile/${post.author_id}`}
      className={`block mt-1 rounded-xl overflow-hidden border w-72 max-w-full transition-colors ${
        isOwn
          ? "bg-white/10 border-white/25 hover:bg-white/15"
          : "bg-white border-outline-variant/20 hover:bg-surface-container-low"
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
            <p
              className={`text-label-sm font-semibold truncate ${
                isOwn ? "text-white" : "text-on-surface"
              }`}
            >
              {post.author_name ?? "Usuario"}
            </p>
            <p
              className={`text-[10px] ${
                isOwn ? "text-white/70" : "text-on-surface-variant"
              }`}
            >
              Publicacion
            </p>
          </div>
          <MaterialIcon
            name="article"
            className={isOwn ? "text-white/60" : "text-on-surface-variant"}
          />
        </div>
        <p
          className={`text-body-md wrap-break-word line-clamp-4 ${
            isOwn ? "text-white/90" : "text-on-surface"
          }`}
        >
          {post.body}
        </p>
      </div>
      {post.image_url && (
        <Image
          src={mediaSrc(post.image_url)}
          alt="Publicacion"
          width={288}
          height={160}
          className="w-full h-32 object-cover"
          unoptimized
        />
      )}
    </Link>
  );
});

const ReplyPreview = React.memo(function ReplyPreview({ message, onScrollToMessage }: { message: Message; onScrollToMessage?: (id: string) => void }) {
  if (!message.reply_to) return null;
  const r = message.reply_to;
  const senderName = r.sender?.name || "Alguien";
  let preview = r.body || "";
  if (r.kind === "sticker") preview = `Sticker: ${r.body}`;
  else if (r.kind === "poll") preview = `Encuesta: ${r.poll?.question || ""}`;
  else if (r.kind === "voice") preview = "Nota de voz";
  else if (r.kind === "image") preview = "Imagen";
  else if (r.kind === "video") preview = "Video";
  else if (r.kind === "document") preview = r.attachment_name || "Documento";
  else if (r.kind === "post") preview = "Publicacion compartida";
  if (preview.length > 60) preview = preview.slice(0, 60) + "...";

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onScrollToMessage && message.reply_to_id) onScrollToMessage(message.reply_to_id);
      }}
      className="mb-2 pl-3 border-l-3 border-current/40 bg-white/10 rounded-r-lg px-3 py-1.5 -mt-1 w-full text-left hover:bg-white/20 transition-colors cursor-pointer"
    >
      <p className="text-label-sm font-semibold opacity-90">{senderName}</p>
      <p className="text-label-sm opacity-70 truncate">{preview}</p>
    </button>
  );
});

const ReactionBar = React.memo(function ReactionBar({
  reactions,
  messageId,
  onReacted,
}: {
  reactions: MessageReaction[];
  messageId: string;
  onReacted?: () => void;
}) {
  const { user } = useAuthStore();
  const [localReactions, setLocalReactions] = useState<MessageReaction[]>(reactions);
  const tempIdRef = useRef(0);

  const grouped: Record<string, { count: number; users: string[] }> = {};
  for (const r of localReactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, users: [] };
    grouped[r.emoji].count++;
    grouped[r.emoji].users.push(r.user_id);
  }

  if (Object.keys(grouped).length === 0) return null;

  const handleReactionClick = async (emoji: string) => {
    const myReaction = localReactions.find(
      (r) => r.emoji === emoji && r.user_id === user?.id
    );
    if (myReaction) {
      setLocalReactions((prev) =>
        prev.filter((r) => !(r.emoji === emoji && r.user_id === user?.id))
      );
      try {
        await api.removeReaction(messageId, emoji);
        onReacted?.();
      } catch {
        setLocalReactions(reactions);
      }
    } else {
      tempIdRef.current += 1;
      const tempId = `temp-${tempIdRef.current}`;
      const tempReaction: MessageReaction = {
        id: tempId,
        message_id: messageId,
        user_id: user?.id || "",
        emoji,
        created_at: new Date().toISOString(),
      };
      setLocalReactions((prev) => [...prev, tempReaction]);
      try {
        const result = await api.addReaction(messageId, emoji);
        if ("removed" in result) {
          setLocalReactions((prev) =>
            prev.filter((r) => !(r.emoji === emoji && r.user_id === user?.id))
          );
        }
        onReacted?.();
      } catch {
        setLocalReactions(reactions);
      }
    }
  };

  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {Object.entries(grouped).map(([emoji, data]) => {
        const iReacted = data.users.includes(user?.id || "");
        return (
          <button
            key={emoji}
            onClick={() => handleReactionClick(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-label-sm transition-colors ${
              iReacted
                ? "bg-primary/15 border border-primary/30 text-primary"
                : "bg-surface-container-high border border-outline-variant/20 text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            <span className="text-sm">{emoji}</span>
            {data.count > 1 && <span>{data.count}</span>}
          </button>
        );
      })}
    </div>
  );
});

const ReactionPicker = React.memo(function ReactionPicker({
  messageId,
  onReacted,
}: {
  messageId: string;
  onReacted?: () => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowPicker(false);
        setShowFull(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const handleReact = async (emoji: string) => {
    try {
      await api.addReaction(messageId, emoji);
      setShowPicker(false);
      setShowFull(false);
      onReacted?.();
    } catch (e) {
      console.error("Reaction failed", e);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setShowPicker(!showPicker)}
        className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors opacity-0 group-hover:opacity-100"
        title="Reaccionar"
      >
        <MaterialIcon name="add_reaction" className="text-lg" />
      </button>
      {showPicker && (
        <div className="absolute bottom-full right-0 mb-2 bg-surface-container-highest rounded-xl shadow-xl py-2 px-2 z-30 flex gap-1">
          {QUICK_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleReact(emoji)}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowFull(!showFull)}
            className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="more_horiz" className="text-lg" />
          </button>
        </div>
      )}
      {showFull && (
        <div className="absolute bottom-full right-0 mb-2 mt-1 bg-surface-container-highest rounded-xl shadow-xl py-3 px-3 z-30 w-64 max-h-48 overflow-y-auto">
          <div className="flex flex-wrap gap-1">
            {Object.values(STICKER_PACKS)
              .flat()
              .map((emoji, i) => (
                <button
                  key={`${i}-${emoji}`}
                  onClick={() => handleReact(emoji)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-surface-container-high text-xl transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
});

// Need api import for ReactionPicker
import { api } from "@/lib/api";

const MentionText = React.memo(function MentionText({ text, isOwn, members }: { text: string; isOwn: boolean; members?: ChatRoomMemberResponse[] }) {
  const mentionRegex = /@([A-Za-z\u00C0-\u017F]+(?: [A-Za-z\u00C0-\u017F]+)*)/g;
  const urlRegex = /(https?:\/\/[^\s<>"{}|\\^`\[\]]+)/g;

  // First pass: handle mentions
  const mentionParts: React.ReactNode[] = [];
  let mentionLastIndex = 0;
  let mentionMatch;
  while ((mentionMatch = mentionRegex.exec(text)) !== null) {
    if (mentionMatch.index > mentionLastIndex) {
      mentionParts.push(text.slice(mentionLastIndex, mentionMatch.index));
    }
    const mentionedName = mentionMatch[1];
    const member = members?.find(
      (m) => m.user?.name?.toLowerCase() === mentionedName.toLowerCase()
    );
    const userId = member?.user_id;
    const mentionContent = (
      <span
        className={`font-semibold cursor-pointer hover:opacity-80 ${
          isOwn ? "text-white underline" : "text-primary underline"
        }`}
      >
        @{mentionedName}
      </span>
    );
    if (userId) {
      mentionParts.push(
        <Link
          key={mentionMatch.index}
          href={`/profile/${userId}`}
          onClick={(e) => e.stopPropagation()}
        >
          {mentionContent}
        </Link>
      );
    } else {
      mentionParts.push(
        <span key={mentionMatch.index}>{mentionContent}</span>
      );
    }
    mentionLastIndex = mentionMatch.index + mentionMatch[0].length;
  }
  if (mentionLastIndex < text.length) {
    mentionParts.push(text.slice(mentionLastIndex));
  }

  // Now flatten and handle URLs in text segments
  const processUrlInParts = (nodes: React.ReactNode[]): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    for (const node of nodes) {
      if (typeof node === "string") {
        // Linkify URLs in text nodes
        let urlLastIndex = 0;
        let urlMatch;
        while ((urlMatch = urlRegex.exec(node)) !== null) {
          if (urlMatch.index > urlLastIndex) {
            result.push(node.slice(urlLastIndex, urlMatch.index));
          }
          const url = urlMatch[1];
          result.push(
            <a
              key={urlMatch.index}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-80"
            >
              {url}
            </a>
          );
          urlLastIndex = urlMatch.index + urlMatch[0].length;
        }
        if (urlLastIndex < node.length) {
          result.push(node.slice(urlLastIndex));
        }
      } else {
        // React element - leave as is
        result.push(node);
      }
    }
    return result;
  };

  return <span>{processUrlInParts(mentionParts)}</span>;
});

export const MessageBubble = React.memo(function MessageBubble({
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
  members,
}: {
  message: Message;
  isOwn: boolean;
  onReply?: (msg: Message) => void;
  onReactionChange?: () => void;
  onScrollToMessage?: (id: string) => void;
  onTogglePin?: (msg: Message) => void;
  onToggleStar?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
  onEdit?: (msg: Message) => void;
  onDelete?: (msg: Message) => void;
  members?: ChatRoomMemberResponse[];
}) {
  const [dataSaver, setDataSaver] = useState(false);
  const [loadMedia, setLoadMedia] = useState<string | null>(null);
  const kind = message.kind || "text";

  useEffect(() => {
    const saved = localStorage.getItem("nexus-data-saver");
    if (saved === "true") setDataSaver(true);
  }, []);

  const shouldLoadMedia = (url: string) => {
    if (!dataSaver) return true;
    return loadMedia === url;
  };

  return (
    <div
      id={`msg-${message.id}`}
      className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 gap-2 group`}
    >
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" />
        </div>
      )}
      <div className="max-w-[70%] flex flex-col">
        <div
          className={`px-4 py-2.5 ${
            isOwn
              ? "bg-primary text-white rounded-2xl rounded-tr-none"
              : "bg-white text-on-surface rounded-2xl rounded-tl-none border border-outline-variant/20"
          }`}
        >
          <ReplyPreview message={message} onScrollToMessage={onScrollToMessage} />

          {kind === "poll" && message.poll && (
            <PollView poll={message.poll} isOwn={isOwn} />
          )}

          {kind === "post" && (
            <PostShareView message={message} isOwn={isOwn} />
          )}

          {kind === "sticker" && message.body && (
            <StickerView sticker={message.body} />
          )}

          {kind === "voice" && message.attachment_url && (
            <VoiceView message={message} isOwn={isOwn} />
          )}

          {kind === "document" && message.attachment_url && (
            <DocumentView message={message} isOwn={isOwn} />
          )}

          {(kind === "text" || kind === "image" || kind === "video" || kind === "audio") &&
            message.body && (
              <p className="text-body-md wrap-break-word">
                <MentionText text={message.body} isOwn={isOwn} members={members} />
              </p>
            )}

          {message.attachment_url &&
            ["image", "video", "audio"].some((t) => kind.startsWith(t)) && (
              <div className="mt-2">
                {dataSaver && !shouldLoadMedia(message.attachment_url!) ? (
                  <button
                    onClick={() => setLoadMedia(message.attachment_url!)}
                    className="w-full aspect-video rounded-xl bg-surface-container-high flex flex-col items-center justify-center gap-2 p-4 text-center border border-outline-variant/30 hover:border-primary/50 transition-colors"
                    title="Tocar para cargar (modo ahorro de datos activado)"
                  >
                    <MaterialIcon
                      name={
                        kind.startsWith("image") ? "image" :
                        kind.startsWith("video") ? "videocam" : "music_note"
                      }
                      className="text-4xl text-on-surface-variant"
                    />
                    <span className="text-label-sm text-on-surface-variant">
                      {kind.startsWith("image") ? "Imagen" :
                       kind.startsWith("video") ? "Video" : "Audio"}
                    </span>
                    <span className="text-xs text-primary font-medium">
                      Tocar para cargar
                    </span>
                  </button>
                ) : kind.startsWith("image") ? (
                  <Image
                    src={mediaSrc(message.attachment_url)}
                    alt="Adjunto"
                    width={300}
                    height={200}
                    className="rounded-xl max-h-48 object-cover"
                    unoptimized
                  />
                ) : kind.startsWith("video") ? (
                  <video
                    src={mediaSrc(message.attachment_url)}
                    controls
                    className="rounded-xl max-h-48 w-full"
                  />
                ) : kind.startsWith("audio") ? (
                  <audio
                    src={mediaSrc(message.attachment_url)}
                    controls
                    className="w-full mt-1"
                  />
                ) : null}
              </div>
            )}

          <div
            className={`flex items-center gap-1 mt-1 ${
              isOwn ? "text-white/60" : "text-on-surface-variant"
            }`}
          >
            {message.pinned && (
              <MaterialIcon name="push_pin" className="text-[11px]" filled />
            )}
            <p className="text-[10px]">{formatMessageTime(message.created_at)}</p>
          </div>
        </div>

        {/* Reactions bar */}
        {message.reactions && message.reactions.length > 0 && (
          <ReactionBar reactions={message.reactions} messageId={message.id} onReacted={onReactionChange} />
        )}
      </div>

      {/* Action buttons on hover */}
      <div className="flex flex-col gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {onReply && (
          <button
            onClick={() => onReply(message)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Responder"
          >
            <MaterialIcon name="reply" className="text-base" />
          </button>
        )}
        {onTogglePin && (
          <button
            onClick={() => onTogglePin(message)}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors ${
              message.pinned
                ? "text-primary"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
            title={message.pinned ? "Dejar de fijar" : "Fijar mensaje"}
          >
            <MaterialIcon name="push_pin" className="text-base" filled={message.pinned} />
          </button>
        )}
        {onToggleStar && (
          <button
            onClick={() => onToggleStar(message)}
            className={`w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors ${
              message.starred
                ? "text-warning"
                : "text-on-surface-variant/60 hover:text-warning"
            }`}
            title={message.starred ? "Quitar de destacados" : "Destacar mensaje"}
          >
            <MaterialIcon name="star" className="text-base" filled={message.starred} />
          </button>
        )}
        {onForward && (
          <button
            onClick={() => onForward(message)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Reenviar"
          >
            <MaterialIcon name="forward" className="text-base" />
          </button>
        )}
        <ReactionPicker
          messageId={message.id}
          onReacted={onReactionChange}
        />
        {/* Edit/Delete for own messages */}
        {isOwn && onEdit && message.kind === "text" && !message.edited && (
          <button
            onClick={() => onEdit(message)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant/60 hover:text-on-surface-variant transition-colors"
            title="Editar"
          >
            <MaterialIcon name="edit" className="text-base" />
          </button>
        )}
        {isOwn && onDelete && (
          <button
            onClick={() => onDelete(message)}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-error-container/30 text-error/60 hover:text-error transition-colors"
            title="Eliminar"
          >
            <MaterialIcon name="delete" className="text-base" />
          </button>
        )}
      </div>

      {isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" filled />
        </div>
      )}
    </div>
  );
});

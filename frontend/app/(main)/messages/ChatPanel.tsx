"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import { api, Message, MessageSendData, ChatRoomMemberResponse, UserSearchResult } from "@/lib/api";
import { Avatar } from "@/components/ui";
import { MaterialIcon, getInitials, STICKER_PACKS, computeOnlineStatus, isOnline } from "./helpers";
import { MessageBubble } from "./MessageRenderers";
import PollCreator from "./PollCreator";
import { Virtuoso } from "react-virtuoso";
import { wsClient } from "@/lib/ws";

async function blobToWav(blob: Blob): Promise<Blob> {
  const audioCtx = new AudioContext();
  const arrayBuffer = await blob.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const numChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1;
  const bitDepth = 16;
  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = audioBuffer.length * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeStr(36, "data");
  view.setUint32(40, dataLength, true);
  const channels = [];
  for (let i = 0; i < numChannels; i++) channels.push(audioBuffer.getChannelData(i));
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  audioCtx.close();
  return new Blob([buffer], { type: "audio/wav" });
}

export interface SelectedConv {
  id: string;
  name: string;
  avatar_url?: string;
  type?: "direct" | "room";
  created_by?: string;
  last_active_at?: string;
  online_count?: number;
}

function useVoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const speechRecRef = useRef<any>(null);
  const transcriptRef = useRef<string>("");

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setRecordedBlob(null);
    setRecording(false);
    setIsPlaying(false);
    setTranscribing(false);
    transcriptRef.current = "";
  }, []);

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      chunksRef.current = chunks;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      chunksRef.current = chunks;
      setRecordedBlob(null);
      setElapsed(0);
      setRecording(true);
      transcriptRef.current = "";

      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);

      recorder.start();
    } catch {
      alert("No se pudo acceder al microfono");
    }
  }, []);

  const stopRecording = useCallback((): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        resolve(null);
        cleanup();
        return;
      }

      recorder.onstop = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        mediaRecorderRef.current = null;
        setRecording(false);

        const chunks = chunksRef.current;
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: "audio/webm" });
          setRecordedBlob(blob);
          resolve(blob);
        } else {
          resolve(null);
        }
        chunksRef.current = [];
      };

      recorder.stop();
    });
  }, [cleanup]);

  const startTranscription = useCallback(() => {
    const SpeechRecognitionAPI =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).SpeechRecognition ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      alert("Tu navegador no soporta transcripcion. Intenta con Chrome o Edge.");
      return false;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "es-ES";
    recognition.continuous = true;
    recognition.interimResults = false;
    let finalTranscript = "";

    setTranscribing(true);
    transcriptRef.current = "";

    recognition.onresult = (event: { results: SpeechRecognitionResultList }) => {
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + " ";
        }
      }
      transcriptRef.current = finalTranscript;
    };

    recognition.onerror = () => {
      setTranscribing(false);
    };

    recognition.onend = () => {
      setTranscribing(false);
    };

    try {
      recognition.start();
      speechRecRef.current = recognition;
      return true;
    } catch {
      setTranscribing(false);
      return false;
    }
  }, []);

  const stopTranscription = useCallback(() => {
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch {}
      speechRecRef.current = null;
    }
    setTranscribing(false);
  }, []);

  const playPreview = useCallback(() => {
    if (!recordedBlob) return;
    const url = URL.createObjectURL(recordedBlob);
    const audio = new Audio(url);
    audio.onended = () => setIsPlaying(false);
    audioRef.current = audio;
    audio.play();
    setIsPlaying(true);
  }, [recordedBlob]);

  const pausePreview = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  return {
    recording, elapsed, recordedBlob, isPlaying, transcribing,
    start, stopRecording, playPreview, pausePreview,
    startTranscription, stopTranscription, cleanup, transcriptRef,
    setTranscribing,
  };
}

export default function ChatPanel({
  messages,
  selectedConv,
  onSend,
  onBack,
  showBack,
  onRefresh,
  roomMembers,
  onHideConversation,
  onLeaveRoom,
  hasMore,
  loadingOlder,
  onLoadOlder,
  firstUnreadId,
  unreadCount,
  pinnedMessages,
  onTogglePin,
  onEditMessage,
  onDeleteMessage,
  targetMessageId,
  typingUsers,
  onlineUsers,
}: {
  messages: Message[];
  selectedConv: SelectedConv | null;
  onSend: (data: MessageSendData) => void;
  onBack: () => void;
  showBack: boolean;
  onRefresh?: () => void;
  roomMembers?: ChatRoomMemberResponse[];
  onHideConversation?: (convType: "dm" | "room", convId: string) => void;
  onLeaveRoom?: (roomId: string) => void;
  hasMore?: boolean;
  loadingOlder?: boolean;
  onLoadOlder?: () => void;
  firstUnreadId?: string | null;
  unreadCount?: number;
  pinnedMessages?: Message[];
  onTogglePin?: (message: Message) => void;
  onEditMessage?: (messageId: string, conversationId: string, body: string) => void;
  onDeleteMessage?: (messageId: string, conversationId: string) => void;
  targetMessageId?: string | null;
  typingUsers?: Map<string, string>;
  onlineUsers?: Map<string, boolean>;
}) {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showMuteMenu, setShowMuteMenu] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const handleEdit = useCallback(
    (message: Message) => {
      // TODO: Implement edit modal/inline edit
      const newBody = prompt("Editar mensaje:", message.body || "");
      if (newBody !== null && newBody !== message.body && newBody.trim() && onEditMessage) {
        onEditMessage(message.id, selectedConv?.id || "", newBody.trim());
      }
    },
    [onEditMessage, selectedConv?.id]
  );

  const handleDelete = useCallback(
    (message: Message) => {
      if (confirm("¿Eliminar este mensaje?") && onDeleteMessage) {
        onDeleteMessage(message.id, selectedConv?.id || "");
      }
    },
    [onDeleteMessage, selectedConv?.id]
  );
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionResults, setMentionResults] = useState<UserSearchResult[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; right: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const [stickerTab, setStickerTab] = useState("magicos");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newCount, setNewCount] = useState(0);
  const [showPinned, setShowPinned] = useState(false);
  const voice = useVoiceRecorder();

  // --- Scroll positioning bookkeeping (WhatsApp-style) ---------------------
  // stickToBottom reflects whether the user was near the bottom *before* the
  // last content change, so we know whether to auto-follow new messages.
  const stickToBottomRef = useRef(true);
  const prevConvIdRef = useRef<string | null>(null);
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  const prevScrollHeightRef = useRef(0);
  const jumpedTargetRef = useRef<string | null>(null);

  const NEAR_BOTTOM_PX = 120;
  const PREFETCH_TOP_PX = 300; // start loading older well before the top

  const scrollToBottom = useCallback((smooth = true) => {
    const c = containerRef.current;
    if (!c) return;
    c.scrollTo({ top: c.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    setNewCount(0);
    setShowScrollBtn(false);
    stickToBottomRef.current = true;
  }, []);

  const handleScroll = useCallback(() => {
    const c = containerRef.current;
    if (!c) return;
    const distanceFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight;
    const nearBottom = distanceFromBottom < NEAR_BOTTOM_PX;
    stickToBottomRef.current = nearBottom;
    setShowScrollBtn(!nearBottom);
    if (nearBottom) setNewCount(0);
    // Lazy-load older messages before the user actually hits the top.
    if (c.scrollTop < PREFETCH_TOP_PX && hasMore && !loadingOlder) {
      onLoadOlder?.();
    }
  }, [hasMore, loadingOlder, onLoadOlder]);

  // Position the viewport whenever messages or the conversation change.
  useEffect(() => {
    const c = containerRef.current;
    if (!c) return;
    const convId = selectedConv?.id ?? null;
    const first = messages[0]?.id ?? null;
    const last = messages[messages.length - 1]?.id ?? null;

    if (prevConvIdRef.current !== convId) {
      // Wait until the first page has actually loaded before positioning, so
      // the transient "empty" reset render doesn't consume the switch.
      if (messages.length === 0) return;
      // Fresh conversation: jump to the unread divider, else to the bottom.
      prevConvIdRef.current = convId;
      prevFirstIdRef.current = first;
      prevLastIdRef.current = last;
      requestAnimationFrame(() => {
        const cc = containerRef.current;
        if (!cc) return;
        if (firstUnreadId && dividerRef.current) {
          dividerRef.current.scrollIntoView({ block: "center" });
          stickToBottomRef.current = false;
          setShowScrollBtn(true);
        } else {
          cc.scrollTop = cc.scrollHeight;
          stickToBottomRef.current = true;
          setShowScrollBtn(false);
        }
        prevScrollHeightRef.current = cc.scrollHeight;
      });
      return;
    }

    // Older page prepended at the top: keep the current view anchored.
    if (first !== prevFirstIdRef.current) {
      const delta = c.scrollHeight - prevScrollHeightRef.current;
      if (delta > 0) c.scrollTop += delta;
    }
    // New message appended at the bottom.
    if (last !== prevLastIdRef.current) {
      if (stickToBottomRef.current) {
        c.scrollTop = c.scrollHeight;
      } else {
        setNewCount((n) => n + 1);
        setShowScrollBtn(true);
      }
    }
    prevFirstIdRef.current = first;
    prevLastIdRef.current = last;
    prevScrollHeightRef.current = c.scrollHeight;
  }, [messages, selectedConv?.id, firstUnreadId]);

  // Jump + highlight a specific message (from a mention notification).
  useEffect(() => {
    if (!targetMessageId || jumpedTargetRef.current === targetMessageId) return;
    if (!messages.some((m) => m.id === targetMessageId)) return; // not loaded yet
    jumpedTargetRef.current = targetMessageId;
    requestAnimationFrame(() => {
      const el = document.getElementById(`msg-${targetMessageId}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("highlight-message");
      setTimeout(() => el.classList.remove("highlight-message"), 2000);
    });
  }, [targetMessageId, messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const isOutside =
        (!menuRef.current || !menuRef.current.contains(target)) &&
        (!moreButtonRef.current || !moreButtonRef.current.contains(target));
      if (isOutside) {
        setShowMenu(false);
        setShowMuteMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isRoom = selectedConv?.type === "room";

  // Mention search
  useEffect(() => {
    if (!mentionSearch || mentionSearch.length < 1) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const friendsOnly = !isRoom;
        const results = await api.searchUsers(mentionSearch, friendsOnly);
        if (!cancelled) {
          setMentionResults(results);
          setShowMentionDropdown(results.length > 0);
        }
      } catch {
        if (!cancelled) {
          setMentionResults([]);
          setShowMentionDropdown(false);
        }
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mentionSearch, isRoom]);

  const buildBaseData = useCallback(
    (extra?: Partial<MessageSendData>): MessageSendData => ({
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      ...(replyingTo ? { reply_to_id: replyingTo.id } : {}),
      ...extra,
    }),
    [isRoom, selectedConv, replyingTo]
  );

  const clearInputState = useCallback(() => {
    setInput("");
    setAttachment(null);
    setReplyingTo(null);
    setShowStickers(false);
    setShowPoll(false);
  }, []);

  // Sending our own message should always snap us to the bottom.
  const doSend = useCallback(
    (data: MessageSendData) => {
      stickToBottomRef.current = true;
      setNewCount(0);
      onSend(data);
    },
    [onSend]
  );

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;

    const data = buildBaseData({ body: trimmed || " " });

    if (attachment) {
      data.attachment_url = attachment.url;
      data.attachment_type = attachment.type;
      data.attachment_name = attachment.name;
      data.kind = attachment.type.startsWith("image")
        ? "image"
        : attachment.type.startsWith("video")
        ? "video"
        : attachment.type.startsWith("audio")
        ? "audio"
        : "document";
    }

    doSend(data);
    clearInputState();
  };

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (selectedConv?.id && wsClient.isConnected()) {
        wsClient.typingStart(selectedConv.id);
      }
      const atIndex = value.lastIndexOf("@");
      if (atIndex >= 0 && (atIndex === 0 || value[atIndex - 1] === " ")) {
        const query = value.slice(atIndex + 1);
        if (query.length > 0 && !query.includes(" ")) {
          setMentionSearch(query);
          return;
        }
      }
      setMentionSearch("");
      setShowMentionDropdown(false);
      setMentionResults([]);
    },
    [selectedConv]
  );

  const handleTypingStop = useCallback(() => {
    if (selectedConv?.id && wsClient.isConnected()) {
      wsClient.typingStop(selectedConv.id);
    }
  }, [selectedConv]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      setAttachment({
        url: result.url,
        type: result.type,
        name: result.original_name,
      });
    } catch (err) {
      console.error("Upload failed", err);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSendVoice = async () => {
    const blob = voice.recordedBlob;
    if (!blob) return;

    setUploading(true);
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const result = await api.uploadFile(file);
      doSend({
        ...buildBaseData({
          body: " ",
          attachment_url: result.url,
          attachment_type: "audio/webm",
          attachment_name: file.name,
          kind: "voice",
          metadata: { duration: voice.elapsed },
        }),
      });
      clearInputState();
      voice.cleanup();
    } catch (err) {
      console.error("Voice upload failed", err);
    }
    setUploading(false);
  };

  const handleTranscribeVoice = async () => {
    if (voice.transcribing) return;
    const blob = voice.recordedBlob;
    if (!blob) return;

    voice.setTranscribing(true);
    try {
      const wavBlob = await blobToWav(blob);
      const result = await api.transcribeAudio(wavBlob);
      if (result.text.trim()) {
        doSend(buildBaseData({ body: result.text.trim(), kind: "text" }));
        clearInputState();
        voice.cleanup();
      } else {
        alert("No se pudo reconocer el audio. Intenta grabar de nuevo.");
        voice.setTranscribing(false);
      }
    } catch {
      alert("Error al transcribir. Intenta de nuevo.");
      voice.setTranscribing(false);
    }
  };

  const handleStopRecording = () => {
    voice.stopRecording();
  };

  const handleCancelRecording = () => {
    voice.cleanup();
  };

  const scrollToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("highlight-message");
    setTimeout(() => el.classList.remove("highlight-message"), 2000);
  };

  const previewOf = (m: Message) => {
    if (m.kind === "sticker") return `Sticker ${m.body || ""}`;
    if (m.kind === "poll") return `Encuesta: ${m.poll?.question || ""}`;
    if (m.kind === "voice") return "Nota de voz";
    if (m.kind === "image") return "Imagen";
    if (m.kind === "video") return "Video";
    if (m.kind === "document") return m.attachment_name || "Documento";
    if (m.kind === "post") return "Publicacion compartida";
    return m.body || "";
  };

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSelectMention = (name: string) => {
    const atIndex = input.lastIndexOf("@");
    if (atIndex >= 0) {
      const before = input.slice(0, atIndex);
      setInput(`${before}@${name} `);
    }
    setShowMentionDropdown(false);
    setMentionSearch("");
    setMentionResults([]);
    inputRef.current?.focus();
  };

  const handleHideConversation = () => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    if (onHideConversation) {
      onHideConversation(convType, selectedConv.id);
    }
    setShowMenu(false);
  };

  const handleLeaveRoom = () => {
    if (!selectedConv || selectedConv.type !== "room") return;
    if (!confirm("¿Seguro que quieres salir del grupo?")) return;
    if (onLeaveRoom) {
      onLeaveRoom(selectedConv.id);
    }
    setShowMenu(false);
  };

  const handleMuteConversation = async (duration: "8h" | "24h" | "forever" | "off") => {
    if (!selectedConv) return;
    const convType = selectedConv.type === "room" ? "room" : "dm";
    try {
      await api.muteConversation(convType, selectedConv.id, duration);
      setShowMuteMenu(false);
      setShowMenu(false);
      onRefresh?.();
    } catch (err) {
      console.error("Mute failed", err);
    }
  };

  const sendSticker = (sticker: string) => {
    doSend(buildBaseData({ body: sticker, kind: "sticker" }));
    setShowStickers(false);
    setReplyingTo(null);
  };

  const handlePollCreate = (
    question: string,
    options: string[],
    multiChoice: boolean
  ) => {
    doSend(
      buildBaseData({
        body: "",
        kind: "poll",
        poll: { question, options, multi_choice: multiChoice },
      })
    );
    setShowPoll(false);
    setReplyingTo(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="relative z-50 flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
        {showBack && (
          <button
            onClick={onBack}
            className="p-1 rounded-full hover:bg-surface-container-high transition-colors mr-1"
          >
            <MaterialIcon name="arrow_back" className="text-xl" />
          </button>
        )}
        <Avatar
          src={selectedConv?.avatar_url}
          alt={selectedConv?.name}
          size="sm"
          initials={getInitials(selectedConv?.name || "")}
          status={
            selectedConv?.type === "room"
              ? undefined
              : onlineUsers?.get(selectedConv?.id || "") === true
                ? "online"
                : computeOnlineStatus(selectedConv?.last_active_at).status
          }
        />
        <div className="flex-1">
          <p className="text-body-md font-semibold text-on-surface">
            {selectedConv?.name}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {selectedConv?.type === "room"
              ? (selectedConv?.online_count ?? 0) > 0
                ? `${selectedConv?.online_count} en linea`
                : "Nadie en linea"
              : onlineUsers?.get(selectedConv?.id || "") === true
                ? "En linea"
                : computeOnlineStatus(selectedConv?.last_active_at).text}
          </p>
        </div>
        <div>
          <button
            ref={moreButtonRef}
            onClick={() => {
              if (!showMenu && moreButtonRef.current) {
                const r = moreButtonRef.current.getBoundingClientRect();
                setMenuPosition({ top: r.bottom + 8, right: window.innerWidth - r.right });
              }
              setShowMenu(!showMenu);
              setShowMuteMenu(false);
            }}
            className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="more_vert" className="text-xl" />
          </button>
        </div>
      </div>

      {/* Members Panel */}
      {showMembers && roomMembers && (
        <div className="border-b border-outline-variant/20 bg-surface-container-low max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
            <p className="text-label-sm font-semibold text-on-surface">
              Miembros ({roomMembers.length}) &middot; {roomMembers.filter((m) => isOnline(m.user?.last_active_at)).length} en linea
            </p>
            <button
              onClick={() => setShowMembers(false)}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
          <div className="divide-y divide-outline-variant/10">
            {roomMembers.map((m) => {
              const status = computeOnlineStatus(m.user?.last_active_at);
              return (
              <Link
                key={m.id}
                href={`/profile/${m.user_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/50 transition-colors"
              >
                <Avatar
                  src={m.user?.avatar_url}
                  alt={m.user?.name}
                  size="sm"
                  initials={getInitials(m.user?.name || "?")}
                  status={status.status}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">
                    {m.user?.name || "Usuario"}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {status.text}
                  </p>
                </div>
                {m.role === "admin" && (
                  <span className="text-label-sm bg-secondary-container/40 text-secondary px-2 py-0.5 rounded-full font-medium">
                    Admin
                  </span>
                )}
              </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        {/* Pinned messages bar */}
        {pinnedMessages && pinnedMessages.length > 0 && (
          <div className="absolute top-0 left-0 right-0 z-20">
            <button
              onClick={() => setShowPinned((s) => !s)}
              className="w-full flex items-center gap-2 px-4 py-2 bg-surface-container-high/95 backdrop-blur-sm border-b border-outline-variant/20 text-left hover:bg-surface-container-highest transition-colors"
            >
              <MaterialIcon name="push_pin" className="text-primary text-lg" filled />
              <span className="text-label-sm font-medium text-on-surface flex-1 truncate">
                {pinnedMessages.length} mensaje{pinnedMessages.length !== 1 ? "s" : ""} fijado{pinnedMessages.length !== 1 ? "s" : ""}
              </span>
              <MaterialIcon
                name={showPinned ? "expand_less" : "expand_more"}
                className="text-on-surface-variant text-lg"
              />
            </button>
            {showPinned && (
              <div className="bg-surface-container/95 backdrop-blur-sm border-b border-outline-variant/20 max-h-56 overflow-y-auto divide-y divide-outline-variant/10">
                {pinnedMessages.map((pm) => (
                  <div
                    key={pm.id}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-surface-container-high/60"
                  >
                    <button
                      onClick={() => { setShowPinned(false); scrollToMessage(pm.id); }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <p className="text-label-sm font-semibold text-on-surface truncate">
                        {pm.sender?.name || "Alguien"}
                      </p>
                      <p className="text-label-sm text-on-surface-variant truncate">
                        {previewOf(pm)}
                      </p>
                    </button>
                    {onTogglePin && (
                      <button
                        onClick={() => onTogglePin(pm)}
                        title="Dejar de fijar"
                        className="p-1 rounded-full hover:bg-surface-container-highest text-on-surface-variant shrink-0"
                      >
                        <MaterialIcon name="push_pin" className="text-base" filled />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto px-4 py-4 no-scrollbar"
        >
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MaterialIcon name="forum" className="text-5xl text-outline-variant mb-3" />
              <p className="text-on-surface-variant text-body-md">
                No hay mensajes aún
              </p>
              <p className="text-on-surface-variant/60 text-label-sm mt-1">
                Envia el primer mensaje
              </p>
            </div>
          ) : (
            <>
              {loadingOlder && (
                <div className="flex justify-center py-2">
                  <MaterialIcon
                    name="progress_activity"
                    className="text-xl text-outline-variant animate-spin"
                  />
                </div>
              )}
              {!hasMore && (
                <p className="text-center text-label-sm text-on-surface-variant/50 py-2">
                  Inicio de la conversacion
                </p>
              )}
              <Virtuoso
                data={messages}
                itemContent={(index, msg: Message) => (
                  <div key={msg.id}>
                    {firstUnreadId && msg.id === firstUnreadId && (
                      <div ref={dividerRef} className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-primary/30" />
                        <span className="text-label-sm font-medium text-primary bg-primary/10 px-3 py-0.5 rounded-full whitespace-nowrap">
                          {unreadCount && unreadCount > 0
                            ? `${unreadCount} mensaje${unreadCount !== 1 ? "s" : ""} no leido${unreadCount !== 1 ? "s" : ""}`
                            : "No leidos"}
                        </span>
                        <div className="flex-1 h-px bg-primary/30" />
                      </div>
                    )}
                    <MessageBubble
                      message={msg}
                      isOwn={msg.sender_id === user?.id}
                      onReply={(m) => setReplyingTo(m)}
                      onReactionChange={onRefresh}
                      onScrollToMessage={scrollToMessage}
                      onTogglePin={onTogglePin}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      members={isRoom ? roomMembers : undefined}
                    />
                  </div>
                )}
                style={{ height: "100%" }}
              />
              <div ref={messagesEndRef} />
              {typingUsers && typingUsers.size > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 text-label-sm text-on-surface-variant animate-pulse">
                  <span className="flex items-center gap-1">
                    <span className="flex gap-[2px]">
                      <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-on-surface-variant/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "está escribiendo..." : "están escribiendo..."}
                  </span>
                </div>
              )}
              {!hasMore && (
                <p className="text-center text-label-sm text-on-surface-variant/50 py-2">
                  Inicio de la conversacion
                </p>
              )}
            </>
          )}
        </div>

        {/* Scroll to bottom */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom(true)}
            className="absolute bottom-4 right-4 z-20 w-11 h-11 flex items-center justify-center rounded-full bg-surface-container-highest shadow-lg border border-outline-variant/20 text-on-surface hover:bg-surface-container-high transition-colors"
            title="Ir al ultimo mensaje"
          >
            <MaterialIcon name="keyboard_arrow_down" className="text-2xl" />
            {newCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-on-primary text-[10px] font-semibold">
                {newCount > 99 ? "99+" : newCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
        {/* Reply preview */}
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
            <MaterialIcon name="reply" className="text-primary text-lg shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-label-sm font-medium text-primary">
                Respondiendo a {replyingTo.sender?.name || "alguien"}
              </p>
              <p className="text-label-sm text-on-surface-variant truncate">
                {replyingTo.body || (replyingTo.kind === "sticker" ? "Sticker" : replyingTo.kind === "poll" ? "Encuesta" : "...")}
              </p>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        )}

        {attachment && (
          <div className="mb-2 flex items-center gap-2 bg-surface-container rounded-xl px-3 py-2">
            <MaterialIcon
              name={
                attachment.type.startsWith("image")
                  ? "image"
                  : attachment.type.startsWith("video")
                  ? "videocam"
                  : attachment.type.startsWith("audio")
                  ? "music_note"
                  : "attach_file"
              }
              className="text-lg text-primary"
            />
            <span className="text-label-sm text-on-surface truncate flex-1">
              {attachment.name}
            </span>
            <button
              onClick={() => setAttachment(null)}
              className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        )}

        {showStickers && (
          <div className="mb-2 bg-surface-container rounded-xl p-3 max-h-48 overflow-y-auto">
            <div className="flex gap-1 mb-2 border-b border-outline-variant/20 pb-2 overflow-x-auto no-scrollbar">
              {Object.keys(STICKER_PACKS).map((pack) => (
                <button
                  key={pack}
                  onClick={() => setStickerTab(pack)}
                  className={`px-3 py-1 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                    stickerTab === pack
                      ? "bg-primary text-on-primary"
                      : "text-on-surface-variant hover:bg-surface-container-high"
                  }`}
                >
                  {pack.charAt(0).toUpperCase() + pack.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {STICKER_PACKS[stickerTab].map((s, i) => (
                <button
                  key={`${i}-${s}`}
                  onClick={() => sendSticker(s)}
                  className="w-12 h-12 rounded-xl bg-surface-container-low flex items-center justify-center text-2xl hover:bg-surface-container-high transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {showPoll && (
          <PollCreator onCreate={handlePollCreate} onCancel={() => setShowPoll(false)} />
        )}

        {/* Input bar - three modes: recording, preview, normal */}
        {voice.recording ? (
          <div className="flex items-center gap-2 bg-primary/10 rounded-full px-4 py-2 border border-primary/30">
            <div className="w-3 h-3 rounded-full bg-error animate-pulse" />
            <span className="font-mono text-body-md text-on-surface tabular-nums">
              {formatElapsed(voice.elapsed)}
            </span>
            <div className="flex-1" />
            <button
              onClick={handleStopRecording}
              className="w-9 h-9 flex items-center justify-center bg-error text-white rounded-full hover:opacity-90"
              title="Detener grabacion"
            >
              <MaterialIcon name="stop" className="text-lg" />
            </button>
          </div>
        ) : voice.recordedBlob ? (
          voice.transcribing ? (
            <div className="flex items-center gap-2 bg-secondary/10 rounded-full px-4 py-2 border border-secondary/30">
              <div className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
              <span className="text-body-md text-on-surface font-medium">
                Transcribiendo audio...
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-surface-container rounded-full px-4 py-2 border border-outline-variant/30">
              <button
                onClick={voice.isPlaying ? voice.pausePreview : voice.playPreview}
                className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:opacity-90"
                title={voice.isPlaying ? "Pausar" : "Reproducir"}
              >
                <MaterialIcon name={voice.isPlaying ? "pause" : "play_arrow"} className="text-lg" />
              </button>
              <span className="font-mono text-body-md text-on-surface tabular-nums">
                {formatElapsed(voice.elapsed)}
              </span>
              <div className="flex-1" />
              <button
                onClick={handleCancelRecording}
                className="p-1.5 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                title="Cancelar"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
              <button
                onClick={handleTranscribeVoice}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors text-label-sm font-medium disabled:opacity-40"
                title="Convertir audio a texto"
              >
                <MaterialIcon name="speech_to_text" className="text-lg" />
                Transcribir
              </button>
              <button
                onClick={handleSendVoice}
                disabled={uploading}
                className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full hover:opacity-90 disabled:opacity-40"
                title="Enviar audio"
              >
                <MaterialIcon name="send" className="text-lg" />
              </button>
            </div>
          )
        ) : (
          <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2 relative">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              className="absolute opacity-0 w-0 h-0 pointer-events-none"
              onChange={handleFileSelect}
              disabled={uploading}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
            >
              <MaterialIcon name="add_circle" className="text-xl" />
            </button>

            <button
              onClick={() => setShowStickers(!showStickers)}
              className="p-1 rounded-full text-on-surface-variant hover:text-secondary transition-colors"
              title="Stickers"
            >
              <MaterialIcon name="emoji_emotions" className="text-xl" />
            </button>

            <button
              onClick={() => setShowPoll(!showPoll)}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              title="Crear encuesta"
            >
              <MaterialIcon name="ballot" className="text-xl" />
            </button>

            <button
              onClick={voice.start}
              className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors"
              title="Grabar voz"
            >
              <MaterialIcon name="mic" className="text-xl" />
            </button>

            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => handleInputChange(e.target.value)}
                onBlur={handleTypingStop}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!showMentionDropdown) handleSend();
                  } else if (e.key === "Escape") {
                    setShowMentionDropdown(false);
                  }
                }}
                placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
                className="w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50"
                disabled={uploading}
              />
              {mentionResults.length > 0 && (
                <div className="absolute bottom-full left-0 mb-2 w-64 bg-surface-container-highest rounded-xl shadow-xl py-1 z-30 max-h-48 overflow-y-auto">
                  {mentionResults.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectMention(u.name)}
                      className="flex items-center gap-3 px-3 py-2 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                    >
                      <Avatar
                        src={u.avatar_url}
                        alt={u.name}
                        size="sm"
                        initials={getInitials(u.name)}
                      />
                      <div>
                        <p className="font-medium">{u.name}</p>
                        {u.house && (
                          <p className="text-label-sm text-on-surface-variant">{u.house}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !attachment) || uploading}
              className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>
          </div>
        )}

        {showMenu && menuPosition && createPortal(
          <div
            ref={menuRef}
            className="fixed z-[60] bg-surface-container-highest rounded-xl shadow-xl py-1 w-56"
            style={{ top: menuPosition.top, right: menuPosition.right }}
          >
            {selectedConv?.type === "room" ? (
              <>
                <button
                  onClick={() => { setShowMembers(true); setShowMenu(false); }}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                >
                  <MaterialIcon name="group" className="text-xl" />
                  Ver miembros
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowMuteMenu(!showMuteMenu)}
                    className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                  >
                    <MaterialIcon name="notifications_off" className="text-xl" />
                    Silenciar notificaciones
                    <MaterialIcon name="chevron_right" className="text-lg ml-auto" />
                  </button>
                  {showMuteMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-surface-container-highest rounded-xl shadow-xl py-1 z-[60] w-48">
                      <button
                        onClick={() => handleMuteConversation("8h")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="schedule" className="text-lg" />
                        8 horas
                      </button>
                      <button
                        onClick={() => handleMuteConversation("24h")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="schedule" className="text-lg" />
                        24 horas
                      </button>
                      <button
                        onClick={() => handleMuteConversation("forever")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="block" className="text-lg" />
                        Siempre
                      </button>
                      <div className="border-t border-outline-variant/20 my-1" />
                      <button
                        onClick={() => handleMuteConversation("off")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-primary hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="notifications_active" className="text-lg" />
                        Activar notificaciones
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleLeaveRoom}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-md text-error hover:bg-error-container/30 transition-colors w-full text-left"
                >
                  <MaterialIcon name="logout" className="text-xl" />
                  Salir del grupo
                </button>
                <div className="border-t border-outline-variant/20 my-1" />
                <button
                  onClick={handleHideConversation}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors w-full text-left"
                >
                  <MaterialIcon name="delete" className="text-xl" />
                  Eliminar conversacion
                </button>
              </>
            ) : (
              <>
                <Link
                  href={`/profile/${selectedConv?.id}`}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
                >
                  <MaterialIcon name="person" className="text-xl" />
                  Ver perfil
                </Link>
                <div className="relative">
                  <button
                    onClick={() => setShowMuteMenu(!showMuteMenu)}
                    className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                  >
                    <MaterialIcon name="notifications_off" className="text-xl" />
                    Silenciar notificaciones
                    <MaterialIcon name="chevron_right" className="text-lg ml-auto" />
                  </button>
                  {showMuteMenu && (
                    <div className="absolute left-full top-0 ml-1 bg-surface-container-highest rounded-xl shadow-xl py-1 z-[60] w-48">
                      <button
                        onClick={() => handleMuteConversation("8h")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="schedule" className="text-lg" />
                        8 horas
                      </button>
                      <button
                        onClick={() => handleMuteConversation("24h")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="schedule" className="text-lg" />
                        24 horas
                      </button>
                      <button
                        onClick={() => handleMuteConversation("forever")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="block" className="text-lg" />
                        Siempre
                      </button>
                      <div className="border-t border-outline-variant/20 my-1" />
                      <button
                        onClick={() => handleMuteConversation("off")}
                        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-primary hover:bg-surface-container-high transition-colors w-full text-left"
                      >
                        <MaterialIcon name="notifications_active" className="text-lg" />
                        Activar notificaciones
                      </button>
                    </div>
                  )}
                </div>
                <button
                  onClick={handleHideConversation}
                  className="flex items-center gap-3 px-4 py-2.5 text-body-md text-error hover:bg-error-container/30 transition-colors w-full text-left"
                >
                  <MaterialIcon name="delete" className="text-xl" />
                  Eliminar conversacion
                </button>
              </>
            )}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
}

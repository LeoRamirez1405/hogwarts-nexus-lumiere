"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, Message, MessageSendData, UserSearchResult } from "@/lib/api";
import { wsClient } from "@/lib/ws";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useVideoRecorder } from "./useVideoRecorder";
import { blobToWav } from "../utils/voice";
import type { SelectedConv } from "../types";
import { hapticLight, hapticMedium } from "@/lib/haptics";

export function useChatComposer({
  selectedConv,
  onSend,
}: {
  selectedConv: SelectedConv | null;
  onSend: (data: MessageSendData) => void;
}) {
  const [input, setInput] = useState("");
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [stickerTab, setStickerTab] = useState("magicos");
  const [showPoll, setShowPoll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [mentionSearch, setMentionSearch] = useState("");
  const [mentionResults, setMentionResults] = useState<UserSearchResult[]>([]);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionActiveIndex, setMentionActiveIndex] = useState(0);
  const [disappearAt, setDisappearAt] = useState<string | undefined>(undefined);
  const [scheduleAt, setScheduleAt] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoiceRecorder();
  const video = useVideoRecorder();

  const isRoom = selectedConv?.type === "room";

  // Typing events: throttled (max 1 every 2s) + auto-stop tras 3s de inactividad.
  const TYPING_THROTTLE_MS = 2000;
  const TYPING_STOP_IDLE_MS = 3000;
  const lastTypingSentRef = useRef(0);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    };
  }, []);

  const buildBaseData = useCallback(
    (extra?: Partial<MessageSendData>): MessageSendData => ({
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      ...(replyingTo ? { reply_to_id: replyingTo.id } : {}),
      ...(disappearAt
        ? {
            disappear_at: new Date(
              Date.now() + Number(disappearAt) * 1000
            ).toISOString(),
          }
        : {}),
      ...(scheduleAt ? { scheduled_at: scheduleAt } : {}),
      ...extra,
    }),
    [isRoom, selectedConv, replyingTo, disappearAt, scheduleAt]
  );

  const clearInputState = useCallback(() => {
    setInput("");
    setAttachment(null);
    setReplyingTo(null);
    setShowStickers(false);
    setShowPoll(false);
    setDisappearAt(undefined);
    setScheduleAt(undefined);
  }, []);

  const doSend = useCallback(
    (data: MessageSendData) => {
      onSend(data);
    },
    [onSend]
  );

const handleSend = () => {
  const trimmed = input.trim();
  if (!trimmed && !attachment) return;
  hapticLight();

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

  if (scheduleAt) {
    api.scheduleMessage({
      ...data,
      scheduled_at: scheduleAt,
    }).then(() => {
      clearInputState();
    }).catch(() => {});
  } else {
    doSend(data);
    clearInputState();
  }
};

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value);
      if (selectedConv?.id && wsClient.isConnected()) {
        const now = Date.now();
        if (now - lastTypingSentRef.current >= TYPING_THROTTLE_MS) {
          lastTypingSentRef.current = now;
          wsClient.typingStart(selectedConv.id);
        }
        if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
        typingStopTimerRef.current = setTimeout(() => {
          if (selectedConv?.id && wsClient.isConnected()) {
            wsClient.typingStop(selectedConv.id);
          }
        }, TYPING_STOP_IDLE_MS);
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
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    if (selectedConv?.id && wsClient.isConnected()) {
      wsClient.typingStop(selectedConv.id);
    }
  }, [selectedConv]);

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
          setMentionActiveIndex(0);
        }
      } catch (error) {
        console.error('Failed to search users for mentions:', error);
        if (!cancelled) {
          setMentionResults([]);
          setShowMentionDropdown(false);
        }
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [mentionSearch, isRoom]);

  const handleSelectMention = (name: string) => {
    const atIndex = input.lastIndexOf("@");
    if (atIndex >= 0) {
      const before = input.slice(0, atIndex);
      setInput(`${before}@${name} `);
    }
    setShowMentionDropdown(false);
    setMentionSearch("");
    setMentionResults([]);
    setMentionActiveIndex(0);
    inputRef.current?.focus();
  };

  // El dropdown está abierto de verdad solo cuando hay resultados que mostrar.
  const mentionOpen = showMentionDropdown && mentionResults.length > 0;

  // Navegación con flechas (cíclica).
  const handleMentionMove = (delta: number) => {
    setMentionActiveIndex((i) => {
      const n = mentionResults.length;
      if (n === 0) return 0;
      return (i + delta + n) % n;
    });
  };

  // Confirmar la sugerencia resaltada (Enter / Tab).
  const handleMentionConfirm = () => {
    const picked = mentionResults[mentionActiveIndex];
    if (picked) handleSelectMention(picked.name);
  };

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
    hapticMedium();

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

  const handleSendVideo = async () => {
    const blob = video.recordedBlob;
    if (!blob) return;
    hapticMedium();

    setUploading(true);
    try {
      const file = new File([blob], `video-${Date.now()}.webm`, { type: "video/webm" });
      const result = await api.uploadFile(file);
      doSend({
        ...buildBaseData({
          body: " ",
          attachment_url: result.url,
          attachment_type: "video/webm",
          attachment_name: file.name,
          kind: "video",
          metadata: { duration: video.elapsed },
        }),
      });
      clearInputState();
      video.cleanup();
    } catch (err) {
      console.error("Video upload failed", err);
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
    } catch (error) {
      console.error('Speech recognition error:', error);
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

  const sendSticker = (sticker: string) => {
    hapticLight();
    doSend(buildBaseData({ body: sticker, kind: "sticker" }));
    setShowStickers(false);
    setReplyingTo(null);
  };

  const handlePollCreate = (
    question: string,
    options: string[],
    multiChoice: boolean
  ) => {
    hapticLight();
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

  return {
    input,
    attachment,
    uploading,
    showStickers,
    stickerTab,
    showPoll,
    replyingTo,
    mentionResults,
    showMentionDropdown,
    mentionOpen,
    mentionActiveIndex,
    onMentionHover: setMentionActiveIndex,
    onMentionMove: handleMentionMove,
    onMentionConfirm: handleMentionConfirm,
    voice,
    video,
    inputRef,
    fileInputRef,
    handleSend,
    handleInputChange,
    handleTypingStop,
    handleSelectMention,
    handleFileSelect,
    handleSendVoice,
    handleTranscribeVoice,
    handleStopRecording,
    handleCancelRecording,
    handleStartVideoRecording: video.startRecording,
    handleStopVideoRecording: () => { video.stopRecording(); },
    handleCancelVideoRecording: () => { video.cleanup(); },
    handleSendVideo,
    sendSticker,
    handlePollCreate,
    onCancelReply: () => setReplyingTo(null),
    onRemoveAttachment: () => setAttachment(null),
    onToggleStickers: () => setShowStickers((s) => !s),
    onTogglePoll: () => setShowPoll((s) => !s),
    onCancelPoll: () => setShowPoll(false),
    onStickerTabChange: setStickerTab,
    onDismissMentions: () => setShowMentionDropdown(false),
    onReply: setReplyingTo,
  disappearAt,
  onDisappearChange: setDisappearAt,
  scheduleAt,
  onScheduleChange: setScheduleAt,
};
}

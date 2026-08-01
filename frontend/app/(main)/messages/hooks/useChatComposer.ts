"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { api, Message, MessageSendData, UserSearchResult } from "@/lib/api";
import { wsClient } from "@/lib/ws";
import { useVoiceRecorder } from "./useVoiceRecorder";
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
  const [disappearAt, setDisappearAt] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const voice = useVoiceRecorder();

  const isRoom = selectedConv?.type === "room";

  const buildBaseData = useCallback(
    (extra?: Partial<MessageSendData>): MessageSendData => ({
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      ...(replyingTo ? { reply_to_id: replyingTo.id } : {}),
      ...(disappearAt ? { disappear_at: disappearAt } : {}),
      ...extra,
    }),
    [isRoom, selectedConv, replyingTo, disappearAt]
  );

  const clearInputState = useCallback(() => {
    setInput("");
    setAttachment(null);
    setReplyingTo(null);
    setShowStickers(false);
    setShowPoll(false);
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
    voice,
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
  };
}

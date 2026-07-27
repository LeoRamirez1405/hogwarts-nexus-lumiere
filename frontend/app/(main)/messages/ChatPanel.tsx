"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import { api, Message, MessageSendData } from "@/lib/api";
import { Avatar } from "@/components/ui";
import { MaterialIcon, getInitials, STICKER_PACKS } from "./helpers";
import { MessageBubble } from "./MessageRenderers";
import PollCreator from "./PollCreator";

export interface SelectedConv {
  id: string;
  name: string;
  avatar_url?: string;
  type?: "direct" | "room";
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
  }, []);

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
  };
}

export default function ChatPanel({
  messages,
  selectedConv,
  onSend,
  onBack,
  showBack,
  onRefresh,
}: {
  messages: Message[];
  selectedConv: SelectedConv | null;
  onSend: (data: MessageSendData) => void;
  onBack: () => void;
  showBack: boolean;
  onRefresh?: () => void;
}) {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [stickerTab, setStickerTab] = useState("magicos");
  const voice = useVoiceRecorder();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isRoom = selectedConv?.type === "room";

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

    onSend(data);
    clearInputState();
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

    setUploading(true);
    try {
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      const result = await api.uploadFile(file);
      onSend({
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

  const handleTranscribeVoice = () => {
    if (voice.transcribing) {
      // Already listening — stop and send what we have
      voice.stopTranscription();
      const text = voice.transcriptRef.current.trim();
      if (text) {
        onSend(buildBaseData({ body: text, kind: "text" }));
        clearInputState();
        voice.cleanup();
      } else {
        alert("No se detectó voz. Intenta hablar más alto o más cerca del micrófono.");
      }
    } else {
      // Start listening — discard audio blob, open fresh mic for speech recognition
      voice.startTranscription();
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

  const formatElapsed = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const sendSticker = (sticker: string) => {
    onSend(buildBaseData({ body: sticker, kind: "sticker" }));
    setShowStickers(false);
    setReplyingTo(null);
  };

  const handlePollCreate = (
    question: string,
    options: string[],
    multiChoice: boolean
  ) => {
    onSend(
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
      <div className="flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
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
        />
        <div className="flex-1">
          <p className="text-body-md font-semibold text-on-surface">
            {selectedConv?.name}
          </p>
          <p className="text-label-sm text-on-surface-variant">
            {selectedConv?.type === "room" ? "Grupo" : "En linea"}
          </p>
        </div>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="more_vert" className="text-xl" />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-1 bg-surface-container-highest rounded-xl shadow-xl py-1 z-30 w-52">
              <Link
                href={`/profile/${selectedConv?.id}`}
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <MaterialIcon name="person" className="text-xl" />
                Ver perfil
              </Link>
              <button
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
              >
                <MaterialIcon name="search" className="text-xl" />
                Buscar en mensajes
              </button>
              <button
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-error hover:bg-error-container/30 transition-colors w-full text-left"
              >
                <MaterialIcon name="delete" className="text-xl" />
                Eliminar conversacion
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <MaterialIcon name="forum" className="text-5xl text-outline-variant mb-3" />
            <p className="text-on-surface-variant text-body-md">
              No hay mensajes aun
            </p>
            <p className="text-on-surface-variant/60 text-label-sm mt-1">
              Envia el primer mensaje
            </p>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isOwn={msg.sender_id === user?.id}
                onReply={(m) => setReplyingTo(m)}
                onReactionChange={onRefresh}
                onScrollToMessage={scrollToMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
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
                Escuchando... habla ahora
              </span>
              <div className="flex-1" />
              <button
                onClick={handleTranscribeVoice}
                className="w-9 h-9 flex items-center justify-center bg-secondary text-white rounded-full hover:opacity-90"
                title="Detener y enviar texto"
              >
                <MaterialIcon name="stop" className="text-lg" />
              </button>
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
                title="Grabar voz y enviar como texto"
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
          <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
              className="hidden"
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

            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" &&
                !e.shiftKey &&
                (e.preventDefault(), handleSend())
              }
              placeholder={replyingTo ? "Escribe tu respuesta..." : "Escribe un mensaje..."}
              className="flex-1 bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50"
              disabled={uploading}
            />

            <button
              onClick={handleSend}
              disabled={(!input.trim() && !attachment) || uploading}
              className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
            >
              <MaterialIcon name="send" className="text-lg" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

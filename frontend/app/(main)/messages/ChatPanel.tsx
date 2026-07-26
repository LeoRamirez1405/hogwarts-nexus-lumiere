"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuthStore } from "@/lib/authStore";
import { api, Message, MessageSendData } from "@/lib/api";
import { Avatar, Button } from "@/components/ui";
import { MaterialIcon, getInitials, STICKER_PACKS } from "./helpers";
import { MessageBubble } from "./MessageRenderers";
import PollCreator from "./PollCreator";

export interface SelectedConv {
  id: string;
  name: string;
  avatar_url?: string;
  type?: "direct" | "room";
}

export default function ChatPanel({
  messages,
  selectedConv,
  onSend,
  onBack,
  showBack,
}: {
  messages: Message[];
  selectedConv: SelectedConv | null;
  onSend: (data: MessageSendData) => void;
  onBack: () => void;
  showBack: boolean;
}) {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [recording, setRecording] = useState(false);
  const [hasRecording, setHasRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [stickerTab, setStickerTab] = useState("magicos");

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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;

    const data: MessageSendData = {
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      body: trimmed || " ",
    };

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
    setInput("");
    setAttachment(null);
    setShowStickers(false);
    setShowPoll(false);
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

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        setAudioChunks(chunks);
        setHasRecording(true);
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
      };

      setMediaRecorder(recorder);
      setRecording(true);
      setHasRecording(false);
      setAudioChunks([]);
      recorder.start();
    } catch (err) {
      console.error("Recording failed", err);
      alert("No se pudo acceder al micrófono");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorder) return;
    mediaRecorder.stop();
  };

  const sendVoiceMessage = async () => {
    if (audioChunks.length === 0) return;

    const blob = new Blob(audioChunks, { type: "audio/webm" });
    const file = new File([blob], `voice-${Date.now()}.webm`, {
      type: "audio/webm",
    });

    setUploading(true);
    try {
      const result = await api.uploadFile(file);
      onSend({
        receiver_id: isRoom ? undefined : selectedConv?.id,
        room_id: isRoom ? selectedConv?.id : undefined,
        body: " ",
        attachment_url: result.url,
        attachment_type: "audio/webm",
        attachment_name: file.name,
        kind: "voice",
        metadata: { duration: 0 },
      });
      setAudioChunks([]);
    } catch (err) {
      console.error("Voice upload failed", err);
    }
    setUploading(false);
  };

  const sendSticker = (sticker: string) => {
    onSend({
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      body: sticker,
      kind: "sticker",
    });
    setShowStickers(false);
  };

  const handlePollCreate = (
    question: string,
    options: string[],
    multiChoice: boolean
  ) => {
    onSend({
      receiver_id: isRoom ? undefined : selectedConv?.id,
      room_id: isRoom ? selectedConv?.id : undefined,
      body: "",
      kind: "poll",
      poll: { question, options, multi_choice: multiChoice },
    });
    setShowPoll(false);
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
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
 </div>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
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

{recording && (
          <div className="mb-2 flex items-center gap-3 bg-primary-container/20 rounded-xl px-4 py-3 border border-primary/30">
            <MaterialIcon name="mic" className="text-primary text-xl animate-pulse" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-body-md text-on-surface">
                  Grabando voz...
                </span>
                <span className="text-label-sm text-primary font-mono">
                  🔴 EN VIVO
                </span>
            </div>
      </div>
            <Button variant="secondary" size="sm" icon="stop" onClick={stopRecording}>
              Detener
        </Button>
            <Button
              variant="primary"
              size="sm"
              icon="send"
              onClick={sendVoiceMessage}
              disabled={audioChunks.length === 0 || uploading}
            >
              Enviar
        </Button>
  </div>
        )}

        {!recording && hasRecording && (
          <div className="mb-2 flex items-center gap-3 bg-secondary-container/20 rounded-xl px-4 py-3 border border-secondary/30">
            <MaterialIcon name="mic" className="text-secondary text-xl" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-body-md text-on-surface">
                  Nota de voz lista
                </span>
                <span className="text-label-sm text-secondary font-mono">
                  ✓ LISTO
                </span>
            </div>
      </div>
            <Button
              variant="primary"
              size="sm"
              icon="send"
              onClick={sendVoiceMessage}
              disabled={uploading}
            >
              Enviar nota
        </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="delete"
              onClick={() => { setHasRecording(false); setAudioChunks([]); }}
            >
              Cancelar
        </Button>
  </div>
        )}

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
            onClick={recording ? stopRecording : startRecording}
            className={`p-1 rounded-full transition-colors ${
              recording
                ? "bg-error text-on-error animate-pulse"
                : "text-on-surface-variant hover:text-primary"
            }`}
            title={recording ? "Detener grabación" : "Grabar voz"}
          >
            <MaterialIcon
              name={recording ? "stop" : "mic"}
              className="text-xl"
            />
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
            placeholder="Escribe un mensaje..."
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
 </div>
</div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuthStore } from "@/lib/authStore";
import { api, Conversation, Message, User } from "@/lib/api";
import { Avatar, Badge, SearchBar } from "@/components/ui";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function formatTimestamp(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Ahora";
  if (diffMins < 60) return `${diffMins}m`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

function formatMessageTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 p-4 w-full text-left transition-colors cursor-pointer ${
        isActive
          ? "bg-secondary-container/40"
          : "hover:bg-surface-container-high"
      }`}
    >
      <Avatar
        src={conversation.user.avatar_url}
        alt={conversation.user.name}
        size="sm"
        initials={conversation.user.name
          .split(" ")
          .map((n) => n[0])
          .join("")}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span
            className={`text-body-md truncate ${
              conversation.unread_count > 0
                ? "font-bold text-on-surface"
                : "text-on-surface"
            }`}
          >
            {conversation.user.name}
          </span>
          <span className="text-label-sm text-on-surface-variant ml-2 shrink-0">
            {conversation.last_message
              ? formatTimestamp(conversation.last_message.created_at)
              : ""}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <p
            className={`text-label-sm truncate ${
              conversation.unread_count > 0
                ? "text-on-surface font-medium"
                : "text-on-surface-variant"
            }`}
          >
            {conversation.last_message?.body ?? "Sin mensajes"}
          </p>
          {conversation.unread_count > 0 && (
            <Badge variant="count">{conversation.unread_count}</Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function MessageBubble({
  message,
  isOwn,
}: {
  message: Message;
  isOwn: boolean;
}) {
  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"} mb-3 gap-2`}>
      {!isOwn && (
        <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" />
        </div>
      )}
      <div
        className={`px-4 py-2.5 max-w-[70%] ${
          isOwn
            ? "bg-primary-container text-on-primary-container rounded-2xl rounded-tr-none"
            : "bg-surface-container-high text-on-surface rounded-2xl rounded-tl-none parchment-message"
        }`}
      >
        <p className="text-body-md wrap-break-word">{message.body}</p>
        {message.attachment_url && (
          <div className="mt-2">
            {message.attachment_type?.startsWith("image") ? (
              <Image
                src={message.attachment_url}
                alt="Adjunto"
                width={300}
                height={200}
                className="rounded-xl max-h-48 object-cover"
                unoptimized
              />
            ) : message.attachment_type?.startsWith("video") ? (
              <video
                src={message.attachment_url}
                controls
                className="rounded-xl max-h-48 w-full"
              />
            ) : message.attachment_type?.startsWith("audio") ? (
              <audio src={message.attachment_url} controls className="w-full mt-1" />
            ) : (
              <a
                href={message.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-primary underline text-label-sm"
              >
                <MaterialIcon name="attach_file" className="text-lg" />
                Archivo adjunto
              </a>
            )}
          </div>
        )}
        <p
          className={`text-[10px] mt-1 ${
            isOwn ? "text-on-primary-container/60" : "text-on-surface-variant/60"
          }`}
        >
          {formatMessageTime(message.created_at)}
        </p>
      </div>
      {isOwn && (
        <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container text-label-sm shrink-0 mt-1">
          <MaterialIcon name="person" className="text-lg" filled />
        </div>
      )}
    </div>
  );
}

function ChatPanel({
  messages,
  selectedUser,
  onSend,
  onBack,
  showBack,
}: {
  messages: Message[];
  selectedUser: Conversation["user"];
  onSend: (text: string, attachment?: { url: string; type: string; name: string }) => void;
  onBack: () => void;
  showBack: boolean;
}) {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [attachment, setAttachment] = useState<{ url: string; type: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();
  const menuRef = useRef<HTMLDivElement>(null);

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

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed && !attachment) return;
    onSend(trimmed || " ", attachment || undefined);
    setInput("");
    setAttachment(null);
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
    } catch {
      // error handled by api
    }
    setUploading(false);
    e.target.value = "";
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
          src={selectedUser.avatar_url}
          alt={selectedUser.name}
          size="sm"
          initials={selectedUser.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        />
        <div className="flex-1">
          <p className="text-body-md font-semibold text-on-surface">
            {selectedUser.name}
          </p>
          <p className="text-label-sm text-on-surface-variant">En linea</p>
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
                href={`/profile/${selectedUser.id}`}
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
            <MaterialIcon
              name="forum"
              className="text-5xl text-outline-variant mb-3"
            />
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

      {/* Input */}
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
        <div className="flex items-center gap-2 bg-surface-container-low rounded-full px-4 py-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-1 rounded-full text-on-surface-variant hover:text-primary transition-colors disabled:opacity-40"
          >
            <MaterialIcon name="add_circle" className="text-xl" />
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="Escribe un mensaje..."
            className="flex-1 bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() && !attachment || uploading}
            className="w-9 h-9 flex items-center justify-center bg-primary text-on-primary rounded-full transition-all hover:opacity-90 disabled:opacity-40 disabled:pointer-events-none"
          >
            <MaterialIcon name="send" className="text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user: authUser } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");

  useEffect(() => {
    Promise.all([api.getConversations(), api.getUsers()])
      .then(([convs, users]) => {
        setConversations(convs);
        setAllUsers(users.filter((u) => u.id !== authUser?.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api
      .getMessages(selectedId)
      .then((msgs) => {
        if (!cancelled) setMessages(msgs);
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const handleSend = async (text: string, attachment?: { url: string; type: string }) => {
    if (!selectedId) return;
    try {
      const msg = await api.sendMessage({
        receiver_id: selectedId,
        body: text,
        attachment_url: attachment?.url,
        attachment_type: attachment?.type,
      });
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.user.id === selectedId ? { ...c, last_message: msg } : c
        )
      );
    } catch {}
  };

  const startNewChat = (userId: string) => {
    setShowNewChat(false);
    setNewChatSearch("");
    setSelectedId(userId);
  };

  const selectedConversation = conversations.find(
    (c) => c.user.id === selectedId
  );

  const filtered = conversations.filter((c) =>
    c.user.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = allUsers.filter(
    (u) =>
      !newChatSearch ||
      u.name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(newChatSearch.toLowerCase())
  );

  return (
    <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)] flex flex-col">
      {/* Page Header (mobile only when no chat selected) */}
      {!selectedId && (
        <div className="md:hidden mb-4">
          <h1 className="font-display text-headline-lg text-primary">
            <MaterialIcon
              name="mail"
              className="text-primary mr-2 align-middle"
              filled
            />
            La Lechuza
          </h1>
        </div>
      )}

      <div className="flex-1 flex rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-lowest shadow-sm min-h-0">
        {/* Conversation List */}
        <div
          className={`${
            selectedId ? "hidden xl:flex" : "flex"
          } flex-col w-full xl:w-96 border-r border-outline-variant/20`}
        >
          <div className="p-4 border-b border-outline-variant/20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-title-md font-display text-on-surface">
                Mensajes
              </h2>
              <button
                onClick={() => setShowNewChat(true)}
                className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="edit" className="text-xl" />
              </button>
            </div>
            <SearchBar
              placeholder="Buscar conversaciones..."
              value={search}
              onChange={setSearch}
              size="sm"
            />
          </div>
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <MaterialIcon
                  name="progress_activity"
                  className="text-4xl text-outline-variant animate-spin mb-3"
                />
                <p className="text-on-surface-variant text-label-sm">
                  Cargando lechuzas...
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <MaterialIcon
                  name="inbox"
                  className="text-5xl text-outline-variant mb-3"
                />
                <p className="text-on-surface-variant text-body-md text-center">
                  {search
                    ? "Sin resultados"
                    : "Aun no tienes conversaciones"}
                </p>
              </div>
            ) : (
              filtered.map((conv) => (
                <ConversationItem
                  key={conv.user.id}
                  conversation={conv}
                  isActive={conv.user.id === selectedId}
                  onClick={() => setSelectedId(conv.user.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Chat Panel */}
        <div
          className={`${
            selectedId ? "flex" : "hidden xl:flex"
          } flex-1 flex-col min-w-0`}
        >
          {selectedConversation ? (
            <ChatPanel
              messages={messages}
              selectedUser={selectedConversation.user}
              onSend={handleSend}
              onBack={() => setSelectedId(null)}
              showBack
            />
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
              <div className="w-24 h-24 rounded-full bg-secondary-container/30 flex items-center justify-center mb-4">
                <MaterialIcon
                  name="mail"
                  className="text-5xl text-secondary"
                  filled
                />
              </div>
              <h3 className="font-display text-headline-lg text-on-surface mb-2">
                La Lechuza
              </h3>
              <p className="text-on-surface-variant text-body-md max-w-sm">
                Selecciona una conversacion para empezar a intercambiar
                pergaminos
              </p>
            </div>
          )}
        </div>

        {selectedConversation && (
          <div className="hidden 2xl:flex flex-col w-72 border-l border-outline-variant/20 bg-surface-container-low p-6 overflow-y-auto no-scrollbar">
            <div className="text-center mb-6">
              <Avatar
                src={selectedConversation.user.avatar_url}
                alt={selectedConversation.user.name}
                size="lg"
                className="mx-auto mb-3"
                initials={selectedConversation.user.name.split(" ").map((n) => n[0]).join("")}
              />
              <h3 className="font-display text-title-md text-on-surface">{selectedConversation.user.name}</h3>
              <p className="text-label-sm text-on-surface-variant">{selectedConversation.user.email}</p>
              {selectedConversation.user.house && (
                <div className="mt-2"><Badge variant="tag" color="primary">{selectedConversation.user.house}</Badge></div>
              )}
            </div>
            <div className="space-y-4">
              <div className="bg-surface-container rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Zerines</p>
                <p className="font-display text-headline-lg text-secondary">{selectedConversation.user.zerines?.toLocaleString() ?? "0"}</p>
              </div>
              <div className="bg-surface-container rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">Mensajes</p>
                <p className="font-display text-headline-lg text-primary">{messages.length}</p>
              </div>
              <Link
                href={`/profile/${selectedConversation.user.id}`}
                className="w-full flex items-center justify-center gap-2 border border-outline-variant/30 rounded-xl py-3 text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                <MaterialIcon name="person" className="text-xl" />
                Ver perfil
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowNewChat(false); setNewChatSearch(""); }}
        >
          <div
            className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
              <h2 className="font-display text-title-md text-on-surface">Nuevo mensaje</h2>
              <button
                onClick={() => { setShowNewChat(false); setNewChatSearch(""); }}
                className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
            </div>
            <div className="px-6 py-3">
              <div className="relative">
                <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant" />
                <input
                  type="text"
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="Buscar por nombre o correo..."
                  autoFocus
                  className="w-full bg-surface-container-low rounded-xl pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar">
              {filteredUsers.length === 0 ? (
                <div className="py-12 text-center">
                  <MaterialIcon name="person_search" className="text-4xl text-outline-variant mb-2 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">No se encontraron usuarios</p>
                </div>
              ) : (
                filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => startNewChat(u.id)}
                    className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-surface-container-high transition-colors"
                  >
                    <Avatar
                      src={u.avatar_url}
                      alt={u.name}
                      size="sm"
                      initials={u.name.split(" ").map((n) => n[0]).join("")}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md font-medium text-on-surface truncate">{u.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{u.email}</p>
                    </div>
                    {u.house && (
                      <Badge variant="tag" color="secondary">{u.house}</Badge>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

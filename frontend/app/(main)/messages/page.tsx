"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/lib/authStore";
import { api, Conversation, Message, MessageSendData, User } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "./helpers";
import ConversationItem from "./ConversationItem";
import ChatPanel, { SelectedConv } from "./ChatPanel";
import NewChatModal from "./NewChatModal";
import ThirdPane from "./ThirdPane";

export default function MessagesPage() {
  const { user: authUser, token } = useAuthStore();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<"direct" | "room" | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showNewChat, setShowNewChat] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.getConversations(), api.getUsers()])
      .then(([convs, users]) => {
        setConversations(convs);
        setAllUsers(users.filter((u) => u.id !== authUser?.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [authUser, token]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    const fetchMessages = async () => {
      try {
        const msgs =
          selectedType === "room"
            ? await api.getRoomMessages(selectedId)
            : await api.getMessages(selectedId);
        if (!cancelled) setMessages(msgs);
      } catch {
        if (!cancelled) setMessages([]);
      }
    };
    fetchMessages();
    return () => {
      cancelled = true;
    };
  }, [selectedId, selectedType]);

  const handleSend = async (data: MessageSendData) => {
    if (!selectedId) return;
    try {
      const msg =
        selectedType === "room"
          ? await api.sendRoomMessage(selectedId, data)
          : await api.sendMessage(data);
      setMessages((prev) => [...prev, msg]);
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId ? { ...c, last_message: msg } : c
        )
      );
    } catch (err) {
      console.error("Send failed", err);
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedId);

  const filtered = search
    ? conversations.filter((c) =>
        c.name.toLowerCase().includes(search.toLowerCase())
      )
    : conversations;

  const selectedConv: SelectedConv | null = selectedConversation
    ? {
        id: selectedConversation.id,
        name: selectedConversation.name,
        avatar_url: selectedConversation.avatar_url,
        type: selectedConversation.type as "direct" | "room",
      }
    : null;

  return (
    <div className="h-[calc(100vh-5rem)] md:h-[calc(100vh-5rem)] flex flex-col">
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
                  {search ? "Sin resultados" : "Aun no tienes conversaciones"}
            </p>
          </div>
            ) : (
              filtered.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === selectedId}
                  onClick={() => {
                    setSelectedId(conv.id);
                    setSelectedType(conv.type as "direct" | "room");
                  }}
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
          {selectedConv ? (
            <ChatPanel
              messages={messages}
              selectedConv={selectedConv}
              onSend={handleSend}
              onBack={() => {
                setSelectedId(null);
                setSelectedType(null);
              }}
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
                Selecciona una conversacion para empezar a intercambiar pergaminos
          </p>
        </div>
          )}
      </div>

        {/* Third pane on 2xl+ */}
        {selectedConversation && selectedConversation.type === "direct" && (
          <ThirdPane
            selectedConv={selectedConversation}
            messageCount={messages.length}
          />
        )}
    </div>

      {showNewChat && (
        <NewChatModal
          allUsers={allUsers}
          onSelectUser={(id) => {
            setShowNewChat(false);
            setSelectedId(id);
            setSelectedType("direct");
          }}
          onSelectRoom={(id) => {
            setShowNewChat(false);
            setSelectedId(id);
            setSelectedType("room");
          }}
          onClose={() => setShowNewChat(false)}
        />
      )}
  </div>
  );
}

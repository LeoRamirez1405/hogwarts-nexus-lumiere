"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/api";
import { wsClient, type WSMessage } from "@/lib/ws";

interface UseWebSocketParams {
  authUser: { id: string } | null;
  selectedId: string | null;
  onNewMessage: (conversationId: string, message: Message) => void;
  onTyping: (conversationId: string, userId: string) => void;
  onTypingStop: (conversationId: string, userId: string) => void;
  onPresence: (userId: string, status: "online" | "offline") => void;
  onReadReceipt: (messageId: string) => void;
  onReactionUpdate: (messageId: string, reactions: Message["reactions"]) => void;
  onDelete: (conversationId: string, messageId: string, lastMessage: Message | null) => void;
  onEdit: (message: Message) => void;
  onCatchUpRequested: () => void;
  setConversations?: (fn: (prev: unknown[]) => unknown[]) => void;
}

export function useWebSocket({
  authUser,
  selectedId,
  onNewMessage,
  onTyping,
  onTypingStop,
  onPresence,
  onReadReceipt,
  onReactionUpdate,
  onDelete,
  onEdit,
  onCatchUpRequested,
  setConversations,
}: UseWebSocketParams) {
  const selectedIdRef = useRef(selectedId);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    if (!authUser) return;

    if (!wsClient.isConnected() && wsClient.readyState !== WebSocket.CONNECTING) {
      wsClient.connect();
    }

    const unsubNewMessage = wsClient.on("new_message", (msg: WSMessage) => {
      const conversationId = msg.c;
      const message = msg.m as Message;

      if (selectedIdRef.current === conversationId) {
        onNewMessage(conversationId, message);
      }

      if (setConversations) {
        setConversations((prev) =>
          (prev as { id: string; unread_count: number }[]).map((c) =>
            c.id === conversationId
              ? { ...c, last_message: message, unread_count: c.id !== selectedIdRef.current ? c.unread_count + 1 : c.unread_count }
              : c
          )
        );
      }
    });

    const unsubTyping = wsClient.on("typing", (msg: WSMessage) => {
      onTyping(msg.c as string, msg.u as string);
    });

    const unsubTypingStop = wsClient.on("typing_stop", (msg: WSMessage) => {
      onTypingStop(msg.c as string, msg.u as string);
    });

    const unsubPresence = wsClient.on("presence", (msg: WSMessage) => {
      onPresence(msg.u as string, msg.s as "online" | "offline");
    });

    const unsubReadReceipt = wsClient.on("read_receipt", (msg: WSMessage) => {
      onReadReceipt(msg.m as string);
    });

    const unsubReactionUpdate = wsClient.on("reaction_update", (msg: WSMessage) => {
      onReactionUpdate(msg.m as string, msg.r as Message["reactions"]);
    });

    const unsubDelete = wsClient.on("delete", (msg: WSMessage) => {
      onDelete(msg.c as string, msg.m as string, (msg.lm as Message | null) ?? null);
    });

    const unsubEdit = wsClient.on("edit", (msg: WSMessage) => {
      onEdit(msg.m as Message);
    });

    const unsubCatchUp = wsClient.on("catch_up_requested", () => {
      onCatchUpRequested();
    });

    return () => {
      unsubNewMessage();
      unsubTyping();
      unsubTypingStop();
      unsubPresence();
      unsubReadReceipt();
      unsubReactionUpdate();
      unsubDelete();
      unsubEdit();
      unsubCatchUp();
    };
  }, [authUser, onNewMessage, onTyping, onTypingStop, onPresence, onReadReceipt, onReactionUpdate, onDelete, onEdit, onCatchUpRequested, setConversations]);
}
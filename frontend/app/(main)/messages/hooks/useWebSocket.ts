"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/lib/api";
import { wsClient } from "@/lib/ws";
import {
  WSNewMessage,
  WSTyping,
  WSPresence,
  WSReadReceipt,
  WSReactionUpdate,
  WSDelete,
  WSEdit,
} from "../types";

interface UseWebSocketParams {
  authUser: { id: string } | null;
  selectedId: string | null;
  onNewMessage: (conversationId: string, message: Message) => void;
  onTyping: (conversationId: string, userId: string) => void;
  onTypingStop: (conversationId: string, userId: string) => void;
  onPresence: (userId: string, status: "online" | "offline") => void;
  onReadReceipt: (messageId: string) => void;
  onReactionUpdate: (messageId: string, reactions: Message["reactions"]) => void;
  onDelete: (messageId: string) => void;
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

    const unsubNewMessage = wsClient.on("new_message", (msg: WSNewMessage) => {
      const conversationId = msg.c;
      const message = msg.m;

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

    const unsubTyping = wsClient.on("typing", (msg: WSTyping) => {
      onTyping(msg.c, msg.u);
    });

    const unsubTypingStop = wsClient.on("typing_stop", (msg: WSTyping) => {
      onTypingStop(msg.c, msg.u);
    });

    const unsubPresence = wsClient.on("presence", (msg: WSPresence) => {
      onPresence(msg.u, msg.s);
    });

    const unsubReadReceipt = wsClient.on("read_receipt", (msg: WSReadReceipt) => {
      onReadReceipt(msg.m);
    });

    const unsubReactionUpdate = wsClient.on("reaction_update", (msg: WSReactionUpdate) => {
      onReactionUpdate(msg.m, msg.r);
    });

    const unsubDelete = wsClient.on("delete", (msg: WSDelete) => {
      onDelete(msg.m);
    });

    const unsubEdit = wsClient.on("edit", (msg: WSEdit) => {
      onEdit(msg.m);
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
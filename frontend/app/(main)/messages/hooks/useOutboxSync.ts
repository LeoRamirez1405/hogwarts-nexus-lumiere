"use client";

import { useEffect } from "react";
import type { MessageSendData, Message } from "@/lib/api";
import type { OutboxMessage } from "@/hooks/useIndexedDB";

interface ProcessOutboxFn {
  (callback: (data: MessageSendData, conversationId: string, conversationType: "direct" | "room") => Promise<Message>): Promise<void>;
}

export function useOutboxSync(outboxMessages: OutboxMessage[], processOutbox: ProcessOutboxFn) {
  useEffect(() => {
    const handleOnline = () => {
      if (outboxMessages.length > 0) {
        void processOutbox(async (data: MessageSendData, conversationId: string, conversationType: string) => {
          const { api } = await import("@/lib/api");
          return conversationType === "room"
            ? api.sendRoomMessage(conversationId, data)
            : api.sendMessage(data);
        });
      }
    };
    window.addEventListener("online", handleOnline);
    if (navigator.onLine && outboxMessages.length > 0) handleOnline();
    return () => window.removeEventListener("online", handleOnline);
  }, [outboxMessages, processOutbox]);
}
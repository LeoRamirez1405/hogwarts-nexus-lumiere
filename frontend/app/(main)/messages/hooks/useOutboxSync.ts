"use client";

import { useEffect } from "react";
import type { MessageSendData } from "@/lib/api";

interface ProcessOutboxFn {
  (callback: (data: MessageSendData, conversationId: string, conversationType: string) => Promise<unknown>): void;
}

export function useOutboxSync(outboxMessages: MessageSendData[], processOutbox: ProcessOutboxFn) {
  useEffect(() => {
    const handleOnline = () => {
      if (outboxMessages.length > 0) {
        processOutbox(async (data: MessageSendData, conversationId: string, conversationType: string) => {
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
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Message, MessageSendData } from "@/lib/api";

const DB_NAME = "nexus-messages";
const DB_VERSION = 1;
const MESSAGES_STORE = "messages";
const OUTBOX_STORE = "outbox";

interface CachedMessage extends Message {
  cachedAt: number;
  conversationId: string;
  conversationType: "direct" | "room";
}

export interface OutboxMessage {
  id: string;
  data: MessageSendData;
  conversationId: string;
  conversationType: "direct" | "room";
  createdAt: number;
  retries: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: "id" });
        messagesStore.createIndex("conversationId", "conversationId", { unique: false });
        messagesStore.createIndex("conversationType", "conversationType", { unique: false });
        messagesStore.createIndex("createdAt", "created_at", { unique: false });
      }

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const outboxStore = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        outboxStore.createIndex("conversationId", "conversationId", { unique: false });
        outboxStore.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
  });
}

export function getDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = initDB();
  }
  return dbPromise;
}

export async function cacheMessages(
  messages: Message[],
  conversationId: string,
  conversationType: "direct" | "room"
): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, "readwrite");
  const store = tx.objectStore(MESSAGES_STORE);

  const cachedMessages: CachedMessage[] = messages.map((m) => ({
    ...m,
    cachedAt: Date.now(),
    conversationId,
    conversationType,
  }));

  for (const msg of cachedMessages) {
    store.put(msg);
  }

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCachedMessages(
  conversationId: string,
  conversationType: "direct" | "room",
  limit = 50
): Promise<CachedMessage[]> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, "readonly");
  const store = tx.objectStore(MESSAGES_STORE);
  const index = store.index("conversationId");

  return new Promise((resolve, reject) => {
    const request = index.getAll(IDBKeyRange.only(conversationId));
    request.onsuccess = () => {
      const messages = request.result
        .filter((m) => m.conversationType === conversationType)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, limit);
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function addToOutbox(
  message: Omit<OutboxMessage, "id" | "createdAt" | "retries">
): Promise<string> {
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);

  const id = crypto.randomUUID();
  const outboxMsg: OutboxMessage = {
    ...message,
    id,
    createdAt: Date.now(),
    retries: 0,
  };

  store.add(outboxMsg);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getOutboxMessages(): Promise<OutboxMessage[]> {
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, "readonly");
  const store = tx.objectStore(OUTBOX_STORE);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const messages = request.result.sort((a, b) => a.createdAt - b.createdAt);
      resolve(messages);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function removeFromOutbox(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  store.delete(id);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementOutboxRetries(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(OUTBOX_STORE, "readwrite");
  const store = tx.objectStore(OUTBOX_STORE);
  const request = store.get(id);

  request.onsuccess = () => {
    const msg = request.result;
    if (msg) {
      msg.retries += 1;
      store.put(msg);
    }
  };

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearOldMessages(maxAge = 7 * 24 * 60 * 60 * 1000): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(MESSAGES_STORE, "readwrite");
  const store = tx.objectStore(MESSAGES_STORE);
  const index = store.index("cachedAt");
  const cutoff = Date.now() - maxAge;

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function useIndexedDBMessages(
  conversationId: string | null,
  conversationType: "direct" | "room" | null
) {
  const [cachedMessages, setCachedMessages] = useState<CachedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const loadingRef = useRef(false);

  const loadCached = useCallback(async () => {
    if (!conversationId || !conversationType || loadingRef.current) return;
    loadingRef.current = true;
    setIsLoading(true);

    try {
      const messages = await getCachedMessages(conversationId, conversationType);
      setCachedMessages(messages);
    } catch (error) {
      console.error("Failed to load cached messages:", error);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [conversationId, conversationType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadCached();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadCached]);

  const saveMessages = useCallback(
    async (messages: Message[]) => {
      if (!conversationId || !conversationType) return;
      try {
        await cacheMessages(messages, conversationId, conversationType);
        setCachedMessages((prev) => {
          const existing = new Set(prev.map((m) => m.id));
          const newMsgs = messages
            .filter((m) => !existing.has(m.id))
            .map((m) => ({
              ...m,
              cachedAt: Date.now(),
              conversationId,
              conversationType,
            } as CachedMessage));
          return [...newMsgs, ...prev].sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
        });
      } catch (error) {
        console.error("Failed to cache messages:", error);
      }
    },
    [conversationId, conversationType]
  );

  return {
    cachedMessages,
    isLoading,
    loadCached,
    saveMessages,
  };
}

export function useOutbox() {
  const [outboxMessages, setOutboxMessages] = useState<OutboxMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadOutbox = useCallback(async () => {
    try {
      const messages = await getOutboxMessages();
      setOutboxMessages(messages);
    } catch (error) {
      console.error("Failed to load outbox:", error);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOutbox();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadOutbox]);

  const addMessage = useCallback(
    async (data: MessageSendData, conversationId: string, conversationType: "direct" | "room") => {
      try {
        await addToOutbox({ data, conversationId, conversationType });
        loadOutbox();
      } catch (error) {
        console.error("Failed to add to outbox:", error);
      }
    },
    [loadOutbox]
  );

  const removeMessage = useCallback(
    async (id: string) => {
      try {
        await removeFromOutbox(id);
        loadOutbox();
      } catch (error) {
        console.error("Failed to remove from outbox:", error);
      }
    },
    [loadOutbox]
  );

  const retryMessage = useCallback(
    async (id: string) => {
      try {
        await incrementOutboxRetries(id);
        loadOutbox();
      } catch (error) {
        console.error("Failed to retry message:", error);
      }
    },
    [loadOutbox]
  );

  const processOutbox = useCallback(
    async (sendFn: (data: MessageSendData, conversationId: string, conversationType: "direct" | "room") => Promise<Message>) => {
      if (isProcessing) return;
      setIsProcessing(true);

      try {
        const messages = await getOutboxMessages();
        for (const msg of messages) {
          if (msg.retries >= 5) continue;

          try {
            await sendFn(msg.data, msg.conversationId, msg.conversationType);
            await removeFromOutbox(msg.id);
          } catch (error) {
            console.error('Failed to send outbox message:', error);
            await incrementOutboxRetries(msg.id);
          }
        }
        loadOutbox();
      } catch (error) {
        console.error("Failed to process outbox:", error);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, loadOutbox]
  );

  return {
    outboxMessages,
    isProcessing,
    loadOutbox,
    addMessage,
    removeMessage,
    retryMessage,
    processOutbox,
  };
}
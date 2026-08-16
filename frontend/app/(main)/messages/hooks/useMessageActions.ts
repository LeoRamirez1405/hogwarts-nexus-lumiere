"use client";

import { useCallback, useRef } from "react";
import { api, Message, MessageSendData } from "@/lib/api";
import { toastSuccess, toastError } from "@/lib/toastStore";
import { refreshUserLevelThrottled } from "@/lib/levelUp";
import { markMessageDeleting, healConversationPreview } from "../utils/messageLifecycle";
import type { Conversation, SelectedConvType, MuteDuration } from "../types";

interface WsClient {
  isConnected: () => boolean;
  sendMessage: (conversationId: string, data: MessageSendData & { temp_id?: string }) => void;
  markRead: (conversationId: string, messageId: string) => void;
}

interface E2EEncryption {
  encryptMessage: (userId: string, body: string) => Promise<{ ciphertext: string; message: unknown } | null>;
  loadSafetyNumber: (userId: string) => void;
  verifySafetyNumber: (userId: string) => Promise<boolean>;
  safetyNumberStates: Record<string, { safetyNumber: string | null; verified: boolean; loading: boolean }>;
}

interface UseMessageActionsOptions {
  authUser: { id: string } | null;
  selectedId: string | null;
  selectedType: SelectedConvType | null;
  messagesRef: React.MutableRefObject<Message[]>;
  wsClient: WsClient;
  e2e: E2EEncryption;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setConversations: React.Dispatch<React.SetStateAction<Conversation[]>>;
  setPinnedMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  addToOutbox: (data: MessageSendData, conversationId: string, conversationType: "direct" | "room") => void;
}

export function useMessageActions({
  authUser,
  selectedId,
  selectedType,
  messagesRef,
  wsClient,
  e2e,
  setMessages,
  setConversations,
  setPinnedMessages,
  addToOutbox,
}: UseMessageActionsOptions) {
  const tempIdCounterRef = useRef(0);
  const lastConvRefreshRef = useRef(0);

  const refreshIfConversationMissing = useCallback((convId: string) => {
    setConversations((prev) => {
      // A hidden conversation counts as missing: the server unhides it when a
      // new message arrives, so the inbox must refetch to bring it back.
      if (prev.some((c) => c.id === convId && !c.is_hidden)) return prev;
      // The conversation was deleted/removed and is not in the local inbox;
      // sending a message makes it reappear server-side, so pull the fresh
      // list. The WS never echoes our own messages, so this is the only
      // signal the inbox gets on our own sends. The WS send is fire-and-
      // forget, so retry with delays until the server commits the unhide.
      const now = Date.now();
      if (now - lastConvRefreshRef.current > 5000) {
        lastConvRefreshRef.current = now;
        const attempt = (delay: number, remaining: number) => {
          setTimeout(async () => {
            try {
              const convs = await api.getConversations();
              setConversations(convs);
              if (remaining > 0 && !convs.some((c) => c.id === convId && !c.is_hidden)) {
                attempt(2000, remaining - 1);
              }
            } catch {
              if (remaining > 0) attempt(2000, remaining - 1);
            }
          }, delay);
        };
        attempt(1000, 2);
      }
      return prev;
    });
  }, [setConversations]);

  const handleSend = useCallback(async (data: MessageSendData) => {
    if (!selectedId || !selectedType) return;
    const body = data.body || "";
    const urlRegex = /(https?::\/\/[^\s]+)/g;
    const urls = body.match(urlRegex);
    const previewPromise = urls && urls.length > 0
      ? api.getLinkPreview(urls[0]).catch(() => null)
      : Promise.resolve(null);

    tempIdCounterRef.current += 1;
    const tempId = `temp-${tempIdCounterRef.current}-${Date.now()}`;
    const replyTo = data.reply_to_id
      ? messagesRef.current.find((m) => m.id === data.reply_to_id)
      : undefined;
    const optimistic: Message = {
      id: tempId,
      sender_id: authUser?.id || "",
      receiver_id: data.receiver_id,
      room_id: data.room_id,
      reply_to_id: data.reply_to_id,
      kind: data.kind || "text",
      body: data.body,
      attachment_url: data.attachment_url,
      attachment_type: data.attachment_type,
      attachment_name: data.attachment_name,
      metadata: data.metadata,
      disappear_at: data.disappear_at,
      read: true,
      e2e_encrypted: selectedType === "direct",
      created_at: new Date().toISOString(),
      reply_to: replyTo,
      optimistic: true,
      sending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: optimistic } : c));

    let messageData: MessageSendData & { temp_id?: string } = {
      ...data,
      temp_id: tempId,
    };

    if (selectedType === "direct" && data.body && data.kind === "text") {
      const encrypted = await e2e.encryptMessage(selectedId, data.body);
      if (encrypted) {
        messageData = {
          ...messageData,
          body: encrypted.ciphertext,
          metadata: { ...(data.metadata || {}), e2e_message: encrypted.message, e2e_encrypted: true },
        };
      }
    }

    try {
      if (wsClient.isConnected()) {
        wsClient.sendMessage(selectedId, messageData);
      } else {
        const msg = selectedType === "room"
          ? await api.sendRoomMessage(selectedId, data)
          : await api.sendMessage(data);
        setMessages((prev) =>
          prev
            .filter((m) => m.id !== msg.id)
            .map((m) => (m.id === tempId ? msg : m))
        );
        setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: msg } : c));
        const preview = await previewPromise;
        if (preview) {
          const withPreview = { ...msg, metadata: { ...(msg.metadata || {}), link_preview: preview } };
          setMessages((prev) => prev.map((m) => m.id === msg.id ? withPreview : m));
          setConversations((prev) => prev.map((c) => c.id === selectedId ? { ...c, last_message: withPreview } : c));
        }
      }
      refreshUserLevelThrottled(0);
      refreshIfConversationMissing(selectedId);
    } catch (error) {
      console.error("Failed to send message:", error);
      setMessages((prev) => prev.map((m) => m.id === tempId ? { ...m, sending: false, failed: true } : m));
      addToOutbox(data, selectedId, selectedType);
    }
  }, [selectedId, selectedType, authUser, messagesRef, wsClient, e2e, setMessages, setConversations, addToOutbox, refreshIfConversationMissing]);

  const handleTogglePin = useCallback(async (m: Message) => {
    try {
      const updated = await api.pinMessage(m.id);
      setMessages((prev) => prev.map((x) => x.id === m.id ? { ...x, pinned: updated.pinned } : x));
      // Mantener la lista de mensajes fijados sincronizada en tiempo real
      // con el PinnedMessagesBar. Sin esto, el bar solo se actualiza al
      // reabrir la conversación (useMessages carga pins en montaje).
      setPinnedMessages((prev) => {
        if (!updated.pinned) return prev.filter((pm) => pm.id !== m.id);
        if (prev.some((pm) => pm.id === m.id)) return prev;
        const pinnedMsg = { ...m, pinned: true };
        return [pinnedMsg, ...prev];
      });
    } catch (error) {
      console.error("Failed to toggle pin:", error);
    }
  }, [setMessages, setPinnedMessages]);

  const handleEditMessage = useCallback(async (messageId: string, _convId: string, body: string) => {
    try {
      const updated = await api.editMessage(messageId, body);
      // Usar la respuesta del servidor (no el body optimista): garantiza que el
      // mensaje mostrado sea exactamente lo que queda persistido en el backend.
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, ...updated } : m)));
      // Si el mensaje editado es el último de la conversación, actualizar también
      // el preview de la bandeja de entrada para que refleje el nuevo texto.
      setConversations((prev) =>
        prev.map((c) =>
          c.last_message?.id === messageId ? { ...c, last_message: { ...c.last_message, ...updated } } : c
        )
      );
    } catch (error) {
      console.error("Failed to edit message:", error);
    }
  }, [setMessages, setConversations]);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    const cancelDelete = markMessageDeleting(setMessages, messageId);
    try {
      await api.deleteMessage(messageId);
      if (selectedId) {
        healConversationPreview(setConversations, selectedId, messageId, messagesRef);
      }
    } catch (error) {
      cancelDelete();
      console.error("Failed to delete message:", error);
    }
  }, [setMessages, setConversations, selectedId, messagesRef]);

  const handleForwardMessage = useCallback(async (message: Message, targetId: string, targetType: "dm" | "room"): Promise<boolean> => {
    try {
      await api.forwardMessage(
        message.id,
        targetType === "dm" ? targetId : undefined,
        targetType === "room" ? targetId : undefined
      );
      toastSuccess("Mensaje reenviado", "Se envió a la conversación elegida");
      return true;
    } catch (e) {
      console.error("Failed to forward message:", e);
      toastError("Error al reenviar el mensaje", e);
      return false;
    }
  }, []);

  const handleToggleStar = useCallback(async (message: Message) => {
    try {
      await api.toggleStar(message.id);
      setMessages((prev) => prev.map((m) => m.id === message.id ? { ...m, starred: !m.starred } : m));
    } catch (error) {
      console.error("Failed to toggle star:", error);
    }
  }, [setMessages]);

  const handleMuteConversation = useCallback(async (convType: "dm" | "room", convId: string, duration: MuteDuration) => {
    try {
      await api.muteConversation(convType, convId, duration);
      // Sin esto, el flag is_muted no se actualizaba en la UI tras silenciar;
      // onRefresh solo refresca mensajes, no conversaciones. El usuario no
      // recibía feedback y al volver a abrir el menú no veía "Silenciado".
      const muted = duration !== "off";
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, is_muted: muted } : c));
      if (muted) {
        const label = duration === "forever" ? "siempre" : duration;
        toastSuccess("Notificaciones silenciadas", `Silenciado por ${label}`);
      } else {
        toastSuccess("Notificaciones activadas", "Volverás a recibir avisos");
      }
    } catch (error) {
      toastError("No se pudo cambiar el estado de silencio", error);
    }
  }, [setConversations]);

  const handlePinConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.pinConversation(convType, convId);
      setConversations((prev) => [...prev].map((c) => c.id === convId ? { ...c, is_pinned: true } : c).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
    } catch (error) {
      console.error("Failed to pin conversation:", error);
    }
  }, [setConversations]);

  const handleUnpinConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.unpinConversation(convType, convId);
      setConversations((prev) => [...prev].map((c) => c.id === convId ? { ...c, is_pinned: false } : c).sort((a, b) => (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0)));
    } catch (error) {
      console.error("Failed to unpin conversation:", error);
    }
  }, [setConversations]);

  const handleExportChat = useCallback(async (convType: "dm" | "room", convId: string, convName: string) => {
    const format = confirm("Exportar como JSON? (Cancelar = TXT)") ? "json" : "txt";
    try {
      const blob = convType === "room" ? await api.exportRoomChat(convId, format) : await api.exportDmChat(convId, format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chat-${convName}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("Error al exportar el chat");
    }
  }, []);

  const handleHideConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.hideConversation(convType, convId);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, is_archived: true, is_hidden: true } : c));
    } catch (error) {
      console.error("Failed to hide conversation:", error);
    }
  }, [setConversations]);

  const handleDeleteConversation = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.deleteConversation(convType, convId);
      // Erase the history for me, but keep the conversation in the inbox
      // (server cleared the preview/unread; mirror that locally).
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, last_message: undefined, unread_count: 0 } : c));
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  }, [setConversations]);

  const handleRemoveConversation = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.removeConversation(convType, convId);
      setConversations((prev) => prev.filter((c) => c.id !== convId));
    } catch (error) {
      console.error("Failed to remove conversation:", error);
    }
  }, [setConversations]);

  const handleUnhideConv = useCallback(async (convType: "dm" | "room", convId: string) => {
    try {
      await api.unhideConversation(convType, convId);
      setConversations((prev) => prev.map((c) => c.id === convId ? { ...c, is_archived: false, is_hidden: false } : c));
    } catch (error) {
      console.error("Failed to unhide conversation:", error);
    }
  }, [setConversations]);

  const handleLeaveRoom = useCallback(async (roomId: string) => {
    try {
      await api.leaveRoom(roomId);
      setConversations((prev) => prev.filter((c) => c.id !== roomId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al salir del grupo");
    }
  }, [setConversations]);

  const handleArchiveRoom = useCallback(async (roomId: string) => {
    try {
      await api.archiveRoom(roomId);
      setConversations((prev) => prev.map((c) => c.id === roomId ? { ...c, is_archived: true, is_hidden: true } : c));
    } catch (error) {
      console.error("Failed to archive room:", error);
    }
  }, [setConversations]);

  const handleUnarchiveRoom = useCallback(async (roomId: string) => {
    try {
      await api.unarchiveRoom(roomId);
      setConversations((prev) => prev.map((c) => c.id === roomId ? { ...c, is_archived: false, is_hidden: false } : c));
    } catch (error) {
      console.error("Failed to unarchive room:", error);
    }
  }, [setConversations]);

  return {
    handleSend,
    handleTogglePin,
    handleEditMessage,
    handleDeleteMessage,
    handleForwardMessage,
    handleToggleStar,
    handleMuteConversation,
    handlePinConv,
    handleUnpinConv,
    handleExportChat,
    handleHideConv,
    handleUnhideConv,
    handleDeleteConversation,
    handleRemoveConversation,
    handleLeaveRoom,
    handleArchiveRoom,
    handleUnarchiveRoom,
  };
}
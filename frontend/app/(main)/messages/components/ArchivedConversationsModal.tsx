"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { api, Conversation } from "@/lib/api";
import { MaterialIcon, getInitials } from "../helpers";
import { Avatar, BottomSheet } from "@/components/ui";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

interface ArchivedConversationsModalProps {
  onClose: () => void;
  onSelectConversation: (conv: Conversation) => void;
}

export default function ArchivedConversationsModal({
  onClose,
  onSelectConversation,
}: ArchivedConversationsModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
  const [archivedDms, setArchivedDms] = useState<Conversation[]>([]);
  const [archivedRooms, setArchivedRooms] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"dm" | "room">("dm");

  useEffect(() => {
    let cancelled = false;

    const loadArchived = async () => {
      setLoading(true);
      try {
        const convs = await api.getConversations();
        if (!cancelled) {
          const dms = convs.filter((c) => c.type === "direct" && c.is_hidden);
          const rooms = convs.filter((c) => c.type === "room" && c.is_archived);
          setArchivedDms(dms);
          setArchivedRooms(rooms);
        }
      } catch (err) {
        console.error("Failed to load archived conversations", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadArchived();

    return () => { cancelled = true; };
  }, []);

  const handleRestore = async (conv: Conversation) => {
    const convType = conv.type === "room" ? "room" : "dm";
    try {
      await api.unhideConversation(convType, conv.id);
      onClose();
      onSelectConversation(conv);
    } catch (err) {
      console.error("Failed to restore conversation", err);
    }
  };

  const handleOpen = (conv: Conversation) => {
    onClose();
    onSelectConversation(conv);
  };

  const handleDeletePermanently = async (conv: Conversation) => {
    if (!confirm("¿Eliminar esta conversación? El historial dejará de mostrarse para ti. No se puede deshacer.")) return;
    const convType = conv.type === "room" ? "room" : "dm";
    try {
      await api.deleteConversation(convType, conv.id);
      const convs = await api.getConversations();
      const dms = convs.filter((c) => c.type === "direct" && c.is_archived);
      const rooms = convs.filter((c) => c.type === "room" && c.is_archived);
      setArchivedDms(dms);
      setArchivedRooms(rooms);
    } catch (err) {
      console.error("Failed to delete conversation", err);
    }
  };

  const currentList = activeTab === "dm" ? archivedDms : archivedRooms;
  const emptyMessage = activeTab === "dm"
    ? "No tienes conversaciones directas archivadas"
    : "No tienes grupos archivados";

  const renderTabs = () => (
    <div className="flex border-b border-outline-variant/20 bg-surface-container-lowest">
      <button
        onClick={() => setActiveTab("dm")}
        className={`flex-1 py-2.5 px-4 text-body-md font-medium transition-colors border-b-2 ${activeTab === "dm" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
      >
        Directos ({archivedDms.length})
      </button>
      <button
        onClick={() => setActiveTab("room")}
        className={`flex-1 py-2.5 px-4 text-body-md font-medium transition-colors border-b-2 ${activeTab === "room" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"}`}
      >
        Grupos ({archivedRooms.length})
      </button>
    </div>
  );

  const renderList = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <MaterialIcon name="progress_activity" className="text-3xl text-outline-variant animate-spin" />
        </div>
      );
    }
    if (currentList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <MaterialIcon name="archive" className="text-5xl text-outline-variant mb-3" />
          <p className="text-on-surface-variant text-body-md">{emptyMessage}</p>
        </div>
      );
    }
    return (
      <div className="divide-y divide-outline-variant/20">
        {currentList.map((conv) => (
          <div key={conv.id} className="px-4 py-3 hover:bg-surface-container-low transition-colors">
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleOpen(conv)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                aria-label={`Abrir conversación con ${conv.name}`}
              >
                <Avatar
                  src={conv.avatar_url}
                  alt={conv.name}
                  size="md"
                  initials={getInitials(conv.name)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">{conv.name}</p>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {conv.subtitle || conv.last_message?.body?.slice(0, 50) || "Sin mensajes"}
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleRestore(conv)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
                  aria-label="Restaurar conversación"
                  title="Restaurar"
                >
                  <MaterialIcon name="unarchive" className="text-xl" />
                </button>
                <button
                  onClick={() => handleDeletePermanently(conv)}
                  className="w-9 h-9 inline-flex items-center justify-center rounded-full text-error hover:bg-error-container/30 transition-colors"
                  aria-label="Eliminar permanentemente"
                  title="Eliminar permanentemente"
                >
                  <MaterialIcon name="delete_forever" className="text-xl" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const body = (
    <>
      {renderTabs()}
      <div className={isDesktop ? "max-h-[60vh] overflow-y-auto" : ""}>
        {renderList()}
      </div>
    </>
  );

  if (isDesktop) {
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={onClose} />

        <div className="relative w-full max-w-md bg-surface rounded-2xl overflow-hidden shadow-2xl">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/20 sticky top-0 bg-surface/95 backdrop-blur-sm z-10">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high transition-colors"
                aria-label="Cerrar"
              >
                <MaterialIcon name="close" className="text-xl" />
              </button>
              <h2 className="font-display text-title-md text-on-surface">Archivados</h2>
            </div>
          </div>

          {body}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <BottomSheet open onClose={onClose} title="Archivados">
      {body}
    </BottomSheet>
  );
}
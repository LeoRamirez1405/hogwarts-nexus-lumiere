"use client";

import { useState } from "react";
import { Conversation } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "../helpers";
import { FloatingPopover } from "./FloatingPopover";
import ConversationItem from "../ConversationItem";

export default function ConversationList({
  conversations,
  selectedId,
  search,
  onSearchChange,
  loading,
  onSelectConversation,
  onGlobalSearchToggle,
  showGlobalSearch,
  onRemoveConversation,
}: {
  conversations: Conversation[];
  selectedId: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  loading: boolean;
  onSelectConversation: (id: string, type: "direct" | "room") => void;
  onGlobalSearchToggle: () => void;
  showGlobalSearch: boolean;
  onRemoveConversation?: (convType: "dm" | "room", convId: string) => void;
}) {
  const [menuState, setMenuState] = useState<{
    conv: Conversation;
    x: number;
    y: number;
  } | null>(null);

  const handleRemove = (conv: Conversation) => {
    const convType = conv.type === "room" ? "room" : "dm";
    onRemoveConversation?.(convType, conv.id);
    setMenuState(null);
  };

  return (
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
          <div className="flex items-center gap-2">
            <button
              onClick={onGlobalSearchToggle}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                showGlobalSearch
                  ? "bg-primary text-on-primary"
                  : "hover:bg-surface-container-high text-on-surface-variant"
              }`}
              title="Buscar mensajes globalmente"
            >
              <MaterialIcon name="search" className="text-xl" />
            </button>
          </div>
        </div>
        <SearchBar
          placeholder="Buscar conversaciones..."
          value={search}
          onChange={onSearchChange}
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
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <MaterialIcon
              name="inbox"
              className="text-5xl text-outline-variant mb-3"
            />
            <p className="text-on-surface-variant text-body-md text-center">
              {search ? "Sin resultados" : "Aún no tienes conversaciones"}
            </p>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === selectedId}
              onClick={() =>
                onSelectConversation(conv.id, conv.type as "direct" | "room")
              }
              onLongPress={(e) =>
                setMenuState({ conv, x: e.clientX, y: e.clientY })
              }
            />
          ))
        )}
      </div>

      {menuState && (
        <FloatingPopover
          clientX={menuState.x}
          clientY={menuState.y}
          open={!!menuState}
          onRequestClose={() => setMenuState(null)}
          placement="bottom"
          className="w-56"
        >
          <div className="py-1">
            <p className="px-4 py-2 text-label-xs text-on-surface-variant truncate">
              {menuState.conv.name}
            </p>
            <button
              onClick={() => handleRemove(menuState.conv)}
              className="flex items-center gap-3 px-4 py-2.5 w-full text-left text-body-md text-error hover:bg-error-container/30 transition-colors"
            >
              <MaterialIcon name="delete" className="text-xl" />
              Eliminar
            </button>
          </div>
        </FloatingPopover>
      )}
    </div>
  );
}
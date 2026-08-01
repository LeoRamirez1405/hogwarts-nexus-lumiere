"use client";

import { Conversation } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "../helpers";
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
}: {
  conversations: Conversation[];
  selectedId: string | null;
  search: string;
  onSearchChange: (val: string) => void;
  loading: boolean;
  onSelectConversation: (id: string, type: "direct" | "room") => void;
  onGlobalSearchToggle: () => void;
  showGlobalSearch: boolean;
}) {
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
            />
          ))
        )}
      </div>
    </div>
  );
}
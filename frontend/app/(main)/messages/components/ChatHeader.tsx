"use client";

import { Avatar } from "@/components/ui";
import { E2EIndicator } from "@/components/ui/E2EIndicator";
import { MaterialIcon, getInitials, computeOnlineStatus } from "../helpers";
import type { SelectedConv } from "../types";

interface ChatHeaderProps {
  selectedConv: SelectedConv | null;
  onlineUsers?: Map<string, boolean>;
  showBack: boolean;
  onBack: () => void;
  showInChatSearch: boolean;
  onToggleSearch: () => void;
  moreButtonRef: React.RefObject<HTMLButtonElement | null>;
  onMoreClick: (rect: DOMRect) => void;
  e2eEncrypted?: boolean;
  e2eVerified?: boolean;
  onE2EClick?: () => void;
}

export default function ChatHeader({
  selectedConv,
  onlineUsers,
  showBack,
  onBack,
  showInChatSearch,
  onToggleSearch,
  moreButtonRef,
  onMoreClick,
  e2eEncrypted = false,
  e2eVerified = false,
  onE2EClick,
}: ChatHeaderProps) {

  const isOnlineNow =
    selectedConv?.type !== "room" &&
    onlineUsers?.get(selectedConv?.id || "") === true;

  const status = isOnlineNow
    ? "online"
    : computeOnlineStatus(selectedConv?.last_active_at).status;

  const subtitle = e2eEncrypted
    ? e2eVerified
      ? "Cifrado y verificado"
      : "Cifrado de extremo a extremo"
    : selectedConv?.type === "room"
      ? (selectedConv?.online_count ?? 0) > 0
        ? `${selectedConv?.online_count} en linea`
        : "Nadie en linea"
      : isOnlineNow
        ? "En linea"
        : computeOnlineStatus(selectedConv?.last_active_at).text;

  return (
    <div className="relative flex items-center gap-3 px-4 py-3 border-b border-outline-variant/20 bg-surface/80 backdrop-blur-sm">
      {showBack && (
        <button
          onClick={onBack}
          className="p-1 rounded-full hover:bg-surface-container-high transition-colors mr-1"
        >
          <MaterialIcon name="arrow_back" className="text-xl" />
        </button>
      )}
      <Avatar
        src={selectedConv?.avatar_url}
        alt={selectedConv?.name}
        size="sm"
        initials={getInitials(selectedConv?.name || "")}
        status={selectedConv?.type === "room" ? undefined : status}
      />
      <div className="flex-1 min-w-0">
        <p className="text-body-md font-semibold text-on-surface truncate">
          {selectedConv?.name}
        </p>
        <div className="flex items-center gap-2">
          <p className="text-label-sm text-on-surface-variant truncate">{subtitle}</p>
          {e2eEncrypted && (
            <E2EIndicator
              encrypted={e2eEncrypted}
              verified={e2eVerified}
              onClick={onE2EClick}
            />
          )}
        </div>
      </div>
      <div>
        <button
          onClick={onToggleSearch}
          className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
            showInChatSearch
              ? "bg-primary text-on-primary"
              : "hover:bg-surface-container-high text-on-surface-variant"
          }`}
          title="Buscar en esta conversacion"
        >
          <MaterialIcon name="search" className="text-xl" />
        </button>
        <button
          ref={moreButtonRef}
          onClick={() => {
            if (moreButtonRef.current) {
              onMoreClick(moreButtonRef.current.getBoundingClientRect());
            }
          }}
          className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
        >
          <MaterialIcon name="more_vert" className="text-xl" />
        </button>
      </div>
    </div>
  );
}

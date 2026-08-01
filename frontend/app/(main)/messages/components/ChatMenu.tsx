"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { MaterialIcon } from "../helpers";
import type { SelectedConv, ConvType, MuteDuration } from "../types";

interface ChatMenuProps {
  show: boolean;
  position: { top: number; right: number } | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  selectedConv: SelectedConv | null;
  showMuteMenu: boolean;
  onToggleMuteMenu: () => void;
  onMute: (duration: MuteDuration) => void;
  onClose: () => void;
  onShowMembers: () => void;
  onHideConversation: () => void;
  onLeaveRoom: () => void;
  onPin: (convType: ConvType) => void;
  onUnpin: (convType: ConvType) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onExport: () => void;
}

function MuteSubmenu({
  show,
  onMute,
  onToggle,
}: {
  show: boolean;
  onMute: (duration: MuteDuration) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="notifications_off" className="text-xl" />
        Silenciar notificaciones
        <MaterialIcon name="chevron_right" className="text-lg ml-auto" />
      </button>
      {show && (
        <div className="absolute left-full top-0 ml-1 bg-surface-container-highest rounded-xl shadow-xl py-1 z-[60] w-48">
          <button
            onClick={() => onMute("8h")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="schedule" className="text-lg" />
            8 horas
          </button>
          <button
            onClick={() => onMute("24h")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="schedule" className="text-lg" />
            24 horas
          </button>
          <button
            onClick={() => onMute("forever")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="block" className="text-lg" />
            Siempre
          </button>
          <div className="border-t border-outline-variant/20 my-1" />
          <button
            onClick={() => onMute("off")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-primary hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="notifications_active" className="text-lg" />
            Activar notificaciones
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatMenu({
  show,
  position,
  menuRef,
  selectedConv,
  showMuteMenu,
  onToggleMuteMenu,
  onMute,
  onClose,
  onShowMembers,
  onHideConversation,
  onLeaveRoom,
  onPin,
  onUnpin,
  onArchive,
  onUnarchive,
  onExport,
}: ChatMenuProps) {
  if (!show || !position || !selectedConv) return null;

  const isRoom = selectedConv.type === "room";

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] bg-surface-container-highest rounded-xl shadow-xl py-1 w-56"
      style={{ top: position.top, right: position.right }}
    >
      {isRoom ? (
        <>
          <button
            onClick={onShowMembers}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="group" className="text-xl" />
            Ver miembros
          </button>
          <MuteSubmenu show={showMuteMenu} onToggle={onToggleMuteMenu} onMute={onMute} />
          <button
            onClick={() => onPin("room")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="push_pin" className="text-xl" />
            Fijar al top
          </button>
          <button
            onClick={() => onUnpin("room")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="push_pin" className="text-xl" />
            Desfijar
          </button>
          <button
            onClick={onArchive}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="archive" className="text-xl" />
            Archivar
          </button>
          <button
            onClick={onUnarchive}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="unarchive" className="text-xl" />
            Desarchivar
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="download" className="text-xl" />
            Exportar chat
          </button>
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-error hover:bg-error-container/30 transition-colors w-full text-left"
          >
            <MaterialIcon name="logout" className="text-xl" />
            Salir del grupo
          </button>
          <div className="border-t border-outline-variant/20 my-1" />
          <button
            onClick={onHideConversation}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="delete" className="text-xl" />
            Eliminar conversacion
          </button>
        </>
      ) : (
        <>
          <Link
            href={`/profile/${selectedConv.id}`}
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <MaterialIcon name="person" className="text-xl" />
            Ver perfil
          </Link>
          <MuteSubmenu show={showMuteMenu} onToggle={onToggleMuteMenu} onMute={onMute} />
          <button
            onClick={() => onPin("dm")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="push_pin" className="text-xl" />
            Fijar al top
          </button>
          <button
            onClick={() => onUnpin("dm")}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="push_pin" className="text-xl" />
            Desfijar
          </button>
          <button
            onClick={onExport}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="download" className="text-xl" />
            Exportar chat
          </button>
          <button
            onClick={onHideConversation}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-error hover:bg-error-container/30 transition-colors w-full text-left"
          >
            <MaterialIcon name="delete" className="text-xl" />
            Eliminar conversacion
          </button>
        </>
      )}
    </div>,
    document.body
  );
}

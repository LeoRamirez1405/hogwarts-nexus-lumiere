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
  isPinned: boolean;
  isArchived: boolean;
  isMuted: boolean;
  onToggleMuteMenu: () => void;
  onMute: (duration: MuteDuration) => void;
  onClose: () => void;
  onShowMembers: () => void;
  onShowEvents: () => void;
  onShowVoiceChannels: () => void;
  onShowEditRoom: () => void;
  onShowInvite: () => void;
  onHideConversation: () => void;
  onLeaveRoom: () => void;
  onPin: (convType: ConvType) => void;
  onUnpin: (convType: ConvType) => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onExport: () => void;
  onShowMediaGallery?: () => void;
  isRoom: boolean;
  eventsEnabled: boolean;
  isAdmin: boolean;
}

function MuteTrigger({ onOpen, isMuted }: { onOpen: () => void; isMuted: boolean }) {
  return (
    <button
      onClick={onOpen}
      className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
    >
      <MaterialIcon name={isMuted ? "notifications_off" : "notifications"} className="text-xl" />
      {isMuted ? "Activar notificaciones" : "Silenciar notificaciones"}
      <MaterialIcon name="chevron_right" className="text-lg ml-auto" />
    </button>
  );
}

function MuteView({
  onBack,
  onMute,
  isMuted,
}: {
  onBack: () => void;
  onMute: (duration: MuteDuration) => void;
  isMuted: boolean;
}) {
  return (
    <>
      <button
        onClick={onBack}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md font-medium text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="arrow_back" className="text-xl" />
        Volver
      </button>
      <div className="border-t border-outline-variant/20 my-1" />
      <p className="px-4 py-1 text-label-sm text-on-surface-variant">
        Silenciar durante
      </p>
      <button
        onClick={() => onMute("8h")}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="schedule" className="text-xl" />
        8 horas
      </button>
      <button
        onClick={() => onMute("24h")}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="schedule" className="text-xl" />
        24 horas
      </button>
      <button
        onClick={() => onMute("7d")}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="schedule" className="text-xl" />
        7 días
      </button>
      <button
        onClick={() => onMute("forever")}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="block" className="text-xl" />
        Siempre
      </button>
      <div className="border-t border-outline-variant/20 my-1" />
      <button
        onClick={() => onMute("off")}
        className="flex items-center gap-3 px-4 py-2.5 text-body-md text-primary hover:bg-surface-container-high transition-colors w-full text-left"
      >
        <MaterialIcon name="notifications_active" className="text-xl" />
        Activar notificaciones
        {!isMuted ? <MaterialIcon name="check" className="text-lg ml-auto text-primary" /> : null}
      </button>
    </>
  );
}

export default function ChatMenu({
  show,
  position,
  menuRef,
  selectedConv,
  showMuteMenu,
  isPinned,
  isArchived,
  isMuted,
  onToggleMuteMenu,
  onMute,
  onClose,
  onShowMembers,
  onShowEvents,
  onShowVoiceChannels,
  onShowEditRoom,
  onShowInvite,
  onHideConversation,
  onLeaveRoom,
  onPin,
  onUnpin,
  onArchive,
  onUnarchive,
  onExport,
  onShowMediaGallery,
  isRoom,
  eventsEnabled,
  isAdmin,
}: ChatMenuProps) {
  if (!show || !position || !selectedConv) return null;

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[60] bg-surface-container-highest rounded-xl shadow-xl py-1 w-56"
      style={{ top: position.top, right: position.right }}
    >
      {showMuteMenu ? (
        <MuteView onBack={onToggleMuteMenu} onMute={onMute} isMuted={isMuted} />
      ) : isRoom ? (
        <>
          <button
            onClick={onShowMembers}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="group" className="text-xl" />
            Ver miembros
          </button>
          {eventsEnabled && isAdmin && (
            <button
              onClick={onShowEvents}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="event" className="text-xl" />
              Crear evento
            </button>
          )}
          {isAdmin && (
            <>
              <button
                onClick={onShowVoiceChannels}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
              >
                <MaterialIcon name="voice_chat" className="text-xl" />
                Canales de voz
              </button>
              <button
                onClick={onShowEditRoom}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
              >
                <MaterialIcon name="edit" className="text-xl" />
                Editar grupo
              </button>
              <button
                onClick={onShowInvite}
                className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
              >
                <MaterialIcon name="link" className="text-xl" />
                Invitar por enlace
              </button>
              <div className="border-t border-outline-variant/20 my-1" />
            </>
          )}
          <MuteTrigger onOpen={onToggleMuteMenu} isMuted={isMuted} />
          <button
            onClick={onShowMediaGallery}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="photo_library" className="text-xl" />
            Ver galería
          </button>
          {isPinned ? (
            <button
              onClick={() => onUnpin("room")}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="push_pin" className="text-xl" />
              Desfijar
            </button>
          ) : (
            <button
              onClick={() => onPin("room")}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="push_pin" className="text-xl" />
              Fijar chat
            </button>
          )}
          {isArchived ? (
            <button
              onClick={onUnarchive}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="unarchive" className="text-xl" />
              Desarchivar
            </button>
          ) : (
            <button
              onClick={onArchive}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="archive" className="text-xl" />
              Archivar
            </button>
          )}
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
          <MuteTrigger onOpen={onToggleMuteMenu} isMuted={isMuted} />
          <button
            onClick={onShowMediaGallery}
            className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
          >
            <MaterialIcon name="photo_library" className="text-xl" />
            Ver galería
          </button>
          {isArchived ? (
            <button
              onClick={onUnarchive}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="unarchive" className="text-xl" />
              Desarchivar
            </button>
          ) : (
            <button
              onClick={onArchive}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="archive" className="text-xl" />
              Archivar
            </button>
          )}
          {isPinned ? (
            <button
              onClick={() => onUnpin("direct")}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="push_pin" className="text-xl" />
              Desfijar
            </button>
          ) : (
            <button
              onClick={() => onPin("direct")}
              className="flex items-center gap-3 px-4 py-2.5 text-body-md text-on-surface hover:bg-surface-container-high transition-colors w-full text-left"
            >
              <MaterialIcon name="push_pin" className="text-xl" />
              Fijar chat
            </button>
          )}
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

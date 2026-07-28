"use client";

import { Button, Avatar, Badge, MaterialIcon } from "@/components/ui";
import { User } from "@/lib/api";

interface ProfileHeaderProps {
  profile: User;
  isOwn: boolean;
  onEdit: () => void;
  onMessage: () => void;
  onFriendAction?: {
    status: "none" | "pending_sent" | "pending_received" | "accepted" | "rejected";
    loading: boolean;
    onSend: () => void;
    onAccept: () => void;
    onReject: () => void;
    onCancel: () => void;
  };
}

export function ProfileHeader({
  profile,
  isOwn,
  onEdit,
  onMessage,
  onFriendAction,
}: ProfileHeaderProps) {
  // Action buttons rendered both inline on desktop and in a dedicated
  // full-width row on mobile (so mobile users can message/add/edit).
  const actions = !isOwn ? (
    <>
      <Button variant="primary" icon="mail" onClick={onMessage}>
        Mensaje
      </Button>
      {onFriendAction && (
        <>
          {onFriendAction.status === "none" && (
            <Button variant="secondary" icon="person_add" onClick={onFriendAction.onSend} disabled={onFriendAction.loading}>
              Agregar
            </Button>
          )}
          {onFriendAction.status === "pending_sent" && (
            <Button variant="ghost" icon="hourglass_top" onClick={onFriendAction.onCancel} disabled={onFriendAction.loading}>
              Pendiente
            </Button>
          )}
          {onFriendAction.status === "pending_received" && (
            <>
              <Button variant="primary" icon="check" onClick={onFriendAction.onAccept} disabled={onFriendAction.loading}>
                Aceptar
              </Button>
              <Button variant="ghost" icon="close" onClick={onFriendAction.onReject} disabled={onFriendAction.loading}>
                Rechazar
              </Button>
            </>
          )}
          {onFriendAction.status === "accepted" && (
            <Button variant="secondary" icon="group" disabled>
              Amigos
            </Button>
          )}
          {onFriendAction.status === "rejected" && (
            <Button variant="ghost" icon="person_add" onClick={onFriendAction.onSend} disabled={onFriendAction.loading}>
              Agregar
            </Button>
          )}
        </>
      )}
    </>
  ) : (
    <Button variant="primary" icon="edit" onClick={onEdit}>
      Editar Perfil
    </Button>
  );

  return (
    <div className="relative">
      <div className="h-48 md:h-56 bg-gradient-to-br from-primary via-primary-container to-secondary rounded-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
      </div>
      <div className="max-w-4xl mx-auto px-4">
        <div className="relative -mt-16 md:-mt-20 flex items-end gap-6">
          <div className="relative">
            <Avatar
              src={profile.avatar_url}
              alt={profile.name}
              size="xl"
              borderColor="primary"
              initials={profile.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
              className="w-32! h-32! md:w-40! md:h-40! border-4 border-white shadow-xl"
            />
            {profile.role === "admin" && (
              <span className="absolute bottom-2 right-2 bg-primary text-on-primary w-8 h-8 flex items-center justify-center rounded-full shadow-lg">
                <MaterialIcon name="verified" className="text-xl" filled />
              </span>
            )}
          </div>
          <div className="pb-2 flex-1">
            <h1 className="font-display text-headline-lg md:text-display-lg text-on-surface leading-tight break-words">
              {profile.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {profile.house && (
                <Badge variant="tag" color="secondary">
                  {profile.house}
                </Badge>
              )}
              <span className="text-primary text-body-md font-body">
                {profile.role === "admin" ? "Admin" : "Estudiante"}
              </span>
            </div>
          </div>
          {/* Desktop: inline actions next to the name */}
          <div className="hidden md:flex pb-2 gap-3">{actions}</div>
        </div>

        {/* Mobile: full-width action row below the header */}
        <div className="md:hidden mt-4 flex gap-2 [&>*]:flex-1">{actions}</div>
      </div>
    </div>
  );
}
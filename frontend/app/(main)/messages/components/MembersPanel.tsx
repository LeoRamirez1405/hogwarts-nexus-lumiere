"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui";
import { MaterialIcon, getInitials, computeOnlineStatus, isOnline } from "../helpers";
import type { ChatRoomMemberResponse, RoomInviteInfoResponse } from "@/lib/api";
import { messagesApi } from "@/lib/api/messages";

interface MembersPanelProps {
  members: ChatRoomMemberResponse[];
  roomId: string;
  currentUserId: string;
  isAdmin: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function MembersPanel({
  members,
  roomId,
  currentUserId,
  isAdmin,
  onClose,
  onRefresh,
}: MembersPanelProps) {
  const [inviteModal, setInviteModal] = useState<{
    show: boolean;
    info?: RoomInviteInfoResponse;
    error?: string;
  }>({ show: false });

  const handleCreateInvite = async () => {
    try {
      const invite = await messagesApi.createRoomInvite(roomId, {});
      const link = `${window.location.origin}/messages/invite/${invite.token}`;
      await navigator.clipboard.writeText(link);
      setInviteModal({
        show: true,
        info: {
          room_id: roomId,
          room_name: "",
          member_count: 0,
          requires_approval: false,
          expired: false,
          revoked: false,
          uses_exhausted: false,
        },
        error: `¡Enlace copiado!\n${link}`,
      });
    } catch {
      setInviteModal({
        show: true,
        error: "Error al crear el enlace",
      });
    }
  };

  const handleChangeRole = async (memberId: string, newRole: "admin" | "member") => {
    try {
      await messagesApi.changeMemberRole(roomId, memberId, newRole);
      onRefresh();
    } catch (e) {
      console.error("Error changing role:", e);
    }
  };

  const handleApproveReject = async (userId: string, action: "approve" | "reject") => {
    try {
      await messagesApi.approvePendingMember(roomId, userId, action);
      onRefresh();
    } catch (e) {
      console.error("Error approving/rejecting:", e);
    }
  };

  const pendingMembers = members.filter((m) => m.pending);
  const confirmedMembers = members.filter((m) => !m.pending);

  return (
    <>
      <div className="border-b border-outline-variant/20 bg-surface-container-low max-h-64 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
          <p className="text-label-sm font-semibold text-on-surface">
            Miembros ({confirmedMembers.length})
            {pendingMembers.length > 0 && (
              <span className="ml-2 text-label-sm text-primary">({pendingMembers.length} pendientes)</span>
            )}
            &middot; {confirmedMembers.filter((m) => isOnline(m.user?.last_active_at)).length} en linea
          </p>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleCreateInvite}
                className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-primary-container text-on-primary-container hover:bg-primary-container/80 transition-colors"
                title="Invitar por enlace"
              >
                <MaterialIcon name="link" className="text-lg" />
              </button>
            )}
            <button
              onClick={onClose}
              className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
            >
              <MaterialIcon name="close" className="text-lg" />
            </button>
          </div>
        </div>
        <div className="divide-y divide-outline-variant/10">
          {pendingMembers.length > 0 && (
            <>
              <div className="px-4 py-2 text-label-sm font-medium text-on-surface-variant bg-primary-container/20">
                Solicitudes pendientes
              </div>
              {pendingMembers.map((m) => {
                const status = computeOnlineStatus(m.user?.last_active_at);
                return (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/50 transition-colors"
                  >
                    <Avatar
                      src={m.user?.avatar_url}
                      alt={m.user?.name}
                      size="sm"
                      initials={getInitials(m.user?.name || "?")}
                      status={status.status}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-body-md text-on-surface truncate">
                        {m.user?.name || "Usuario"}
                      </p>
                      <p className="text-label-sm text-on-surface-variant">
                        Esperando aprobaci&oacute;n
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApproveReject(m.user_id, "approve")}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-green-container text-on-green-container hover:bg-green-container/80 transition-colors"
                          title="Aprobar"
                        >
                          <MaterialIcon name="check" className="text-lg" />
                        </button>
                        <button
                          onClick={() => handleApproveReject(m.user_id, "reject")}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-error-container text-on-error-container hover:bg-error-container/80 transition-colors"
                          title="Rechazar"
                        >
                          <MaterialIcon name="close" className="text-lg" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="border-t border-outline-variant/20" />
            </>
          )}
          {confirmedMembers.map((m) => {
            const status = computeOnlineStatus(m.user?.last_active_at);
            const isSelf = m.user_id === currentUserId;
            return (
              <Link
                key={m.id}
                href={`/profile/${m.user_id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-container-high/50 transition-colors"
              >
                <Avatar
                  src={m.user?.avatar_url}
                  alt={m.user?.name}
                  size="sm"
                  initials={getInitials(m.user?.name || "?")}
                  status={status.status}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md text-on-surface truncate">
                    {m.user?.name || "Usuario"}
                    {isSelf && (
                      <span className="ml-2 text-label-sm text-on-surface-variant">(tú)</span>
                    )}
                  </p>
                  <p className="text-label-sm text-on-surface-variant">
                    {status.text}
                  </p>
                </div>
                {m.role === "admin" && (
                  <span className="text-label-sm bg-secondary-container/40 text-secondary px-2 py-0.5 rounded-full font-medium">
                    Admin
                  </span>
                )}
                {isAdmin && !isSelf && m.role === "member" && (
                  <button
                    onClick={() => handleChangeRole(m.user_id, "admin")}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    title="Hacer admin"
                  >
                    <MaterialIcon name="shield" className="text-lg" />
                  </button>
                )}
                {isAdmin && !isSelf && m.role === "admin" && (
                  <button
                    onClick={() => handleChangeRole(m.user_id, "member")}
                    className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
                    title="Quitar admin"
                  >
                    <MaterialIcon name="shield_off" className="text-lg" />
                  </button>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {inviteModal.show && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50"
          onClick={() => setInviteModal({ show: false })}
        >
          <div
            className="bg-surface-container-highest rounded-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <MaterialIcon name="link" className="text-xl text-primary" />
              <h3 className="text-headline-sm text-on-surface">Invitar al grupo</h3>
            </div>
            {inviteModal.error ? (
              <div className="bg-primary-container/20 border border-primary/30 rounded-lg p-4 text-body-md text-on-surface">
                <pre className="whitespace-pre-wrap">{inviteModal.error}</pre>
              </div>
            ) : (
              <p className="text-body-md text-on-surface-variant">
                Comparte este enlace para que otros se unan al grupo.
              </p>
            )}
            <button
              onClick={() => setInviteModal({ show: false })}
              className="mt-4 w-full py-2 px-4 rounded-lg bg-primary text-on-primary font-medium"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </>
  );
}
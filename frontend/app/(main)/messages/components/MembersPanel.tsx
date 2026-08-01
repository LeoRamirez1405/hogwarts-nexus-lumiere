"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui";
import { MaterialIcon, getInitials, computeOnlineStatus, isOnline } from "../helpers";
import type { ChatRoomMemberResponse } from "@/lib/api";

interface MembersPanelProps {
  members: ChatRoomMemberResponse[];
  onClose: () => void;
}

export default function MembersPanel({ members, onClose }: MembersPanelProps) {
  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-low max-h-64 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-2 border-b border-outline-variant/10">
        <p className="text-label-sm font-semibold text-on-surface">
          Miembros ({members.length}) &middot; {members.filter((m) => isOnline(m.user?.last_active_at)).length} en linea
        </p>
        <button
          onClick={onClose}
          className="p-1 rounded-full hover:bg-surface-container-high text-on-surface-variant"
        >
          <MaterialIcon name="close" className="text-lg" />
        </button>
      </div>
      <div className="divide-y divide-outline-variant/10">
        {members.map((m) => {
          const status = computeOnlineStatus(m.user?.last_active_at);
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
            </Link>
          );
        })}
      </div>
    </div>
  );
}

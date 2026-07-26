"use client";

import Link from "next/link";
import { Conversation } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui";
import { MaterialIcon, getInitials } from "./helpers";

export default function ThirdPane({
  selectedConv,
  messageCount,
}: {
  selectedConv: Conversation;
  messageCount: number;
}) {
  return (
    <div className="hidden 2xl:flex flex-col w-72 border-l border-outline-variant/20 bg-surface-container-low p-6 overflow-y-auto no-scrollbar">
      <div className="text-center mb-6">
        <Avatar
          src={selectedConv.avatar_url}
          alt={selectedConv.name}
          size="lg"
          className="mx-auto mb-3"
          initials={getInitials(selectedConv.name)}
        />
        <h3 className="font-display text-title-md text-on-surface">
          {selectedConv.name}
      </h3>
        <p className="text-label-sm text-on-surface-variant">
          {selectedConv.subtitle ?? selectedConv.email ?? "Conversacion"}
      </p>
        {selectedConv.house && (
          <div className="mt-2">
            <Badge variant="tag" color="primary">{selectedConv.house}</Badge>
      </div>
        )}
    </div>
      <div className="space-y-4">
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Zerines
    </p>
          <p className="font-display text-headline-lg text-secondary">
            {selectedConv.zerines?.toLocaleString() ?? "0"}
    </p>
  </div>
        <div className="bg-surface-container rounded-xl p-4 text-center">
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wider mb-1">
            Mensajes
    </p>
          <p className="font-display text-headline-lg text-primary">
            {messageCount}
    </p>
  </div>
        <Link
          href={`/profile/${selectedConv.id}`}
          className="w-full flex items-center justify-center gap-2 border border-outline-variant/30 rounded-xl py-3 text-body-md text-on-surface-variant hover:bg-surface-container-high transition-colors"
        >
          <MaterialIcon name="person" className="text-xl" />
          Ver perfil
  </Link>
</div>
</div>
  );
}

"use client";

import { MaterialIcon } from "@/components/ui";
import { Announcement } from "@/lib/api";

interface AnnouncementsSidebarProps {
  announcements: Announcement[];
  loading?: boolean;
}

export function AnnouncementsSidebar({ announcements, loading }: AnnouncementsSidebarProps) {
  return (
    <div className="bg-secondary-fixed/20 border-l-4 border-secondary rounded-r-xl p-5">
      <h3 className="text-title-md font-display text-on-surface mb-3 flex items-center gap-2">
        <MaterialIcon
          name="campaign"
          className="text-secondary text-xl"
          filled
        />
        Anuncios
      </h3>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <MaterialIcon
            name="progress_activity"
            className="text-2xl text-outline-variant animate-spin"
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="text-label-sm text-on-surface-variant leading-relaxed border-b border-secondary/10 pb-2 last:border-0 last:pb-0"
            >
              {a.body}
            </li>
          ))}
          {announcements.length === 0 && (
            <li className="text-label-sm text-on-surface-variant/50 italic">
              No hay anuncios
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
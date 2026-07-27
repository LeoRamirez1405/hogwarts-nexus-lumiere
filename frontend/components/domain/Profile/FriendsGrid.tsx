"use client";

import Link from "next/link";
import { User } from "@/lib/api";
import { Avatar } from "@/components/ui";

interface FriendsGridProps {
  friends: User[];
  showAll?: boolean;
  onShowAll?: () => void;
}

export function FriendsGrid({ friends, showAll = false, onShowAll }: FriendsGridProps) {
  const displayFriends = showAll ? friends : friends.slice(0, 6);

  return (
    <div className="grid grid-cols-3 gap-3">
      {displayFriends.map((f) => (
        <Link
          key={f.id}
          href={`/profile/${f.id}`}
          className="flex flex-col items-center gap-1 group"
        >
          <Avatar
            src={f.avatar_url}
            alt={f.name}
            size="sm"
            initials={f.name
              .split(" ")
              .map((n) => n[0])
              .join("")}
            className="group-hover:ring-2 group-hover:ring-primary transition-all"
          />
          <span className="text-[11px] text-on-surface-variant text-center truncate w-full group-hover:text-primary transition-colors">
            {f.name.split(" ")[0]}
          </span>
        </Link>
      ))}
      {!showAll && friends.length > 6 && onShowAll && (
        <button
          onClick={onShowAll}
          className="col-span-3 mt-2 text-primary text-label-sm font-semibold hover:underline"
        >
          Ver todos los {friends.length} amigos
        </button>
      )}
    </div>
  );
}
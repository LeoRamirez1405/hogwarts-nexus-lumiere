"use client";

import { useState } from "react";
import Link from "next/link";
import { Avatar, MaterialIcon } from "@/components/ui";
import { User } from "@/lib/api";

interface AllFriendsModalProps {
  friends: User[];
  isOpen: boolean;
  onClose: () => void;
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

export function AllFriendsModal({ friends, isOpen, onClose }: AllFriendsModalProps) {
  const [search, setSearch] = useState("");

  const filtered = friends.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20 sticky top-0 bg-surface z-10">
          <div>
            <h2 className="font-display text-title-md text-on-surface">Amigos</h2>
            <p className="text-label-sm text-on-surface-variant">
              {friends.length} {friends.length === 1 ? "amigo" : "amigos"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>
        <div className="px-6 py-3 border-b border-outline-variant/10">
          <div className="relative">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline-variant text-lg"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar amigos..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary/40 transition-colors"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
          {filtered.length === 0 ? (
            <p className="text-center text-label-sm text-on-surface-variant py-8">
              {search ? "No se encontraron amigos" : "Sin amigos todavia"}
            </p>
          ) : (
            <div className="space-y-1">
              {filtered.map((f) => (
                <Link
                  key={f.id}
                  href={`/profile/${f.id}`}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low transition-colors group"
                >
                  <Avatar
                    src={f.avatar_url}
                    alt={f.name}
                    size="md"
                    initials={initialsOf(f.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface group-hover:text-primary transition-colors truncate">
                      {f.name}
                    </p>
                    {f.house && (
                      <p className="text-label-sm text-on-surface-variant truncate">
                        {f.house}
                      </p>
                    )}
                  </div>
                  <MaterialIcon
                    name="chevron_right"
                    className="text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
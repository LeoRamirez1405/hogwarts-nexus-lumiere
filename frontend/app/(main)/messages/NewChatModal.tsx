"use client";

import { useState, useEffect } from "react";
import { api, User, ChatRoomBrief } from "@/lib/api";
import { Avatar, Badge } from "@/components/ui";
import { MaterialIcon, getInitials } from "./helpers";

export default function NewChatModal({
  allUsers,
  onSelectUser,
  onSelectRoom,
  onClose,
}: {
  allUsers: User[];
  onSelectUser: (userId: string) => void;
  onSelectRoom: (roomId: string) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"users" | "rooms">("users");
  const [rooms, setRooms] = useState<ChatRoomBrief[]>([]);
  const [roomsLoaded, setRoomsLoaded] = useState(false);

  useEffect(() => {
    if (tab !== "rooms") return;
    if (roomsLoaded) return;
    let cancelled = false;
    api
      .getRooms()
      .then((rs) => {
        if (cancelled) return;
        setRooms(rs);
        setRoomsLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setRooms([]);
        setRoomsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, roomsLoaded]);

  const roomsLoading = tab === "rooms" && !roomsLoaded;

  const filteredUsers = allUsers.filter(
    (u) =>
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
  );

  const filteredRooms = search
    ? rooms.filter((r) => r.name.toLowerCase().includes(search.toLowerCase()))
    : rooms;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant/20">
          <h2 className="font-display text-title-md text-on-surface">
            Nuevo mensaje
         </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          >
            <MaterialIcon name="close" className="text-xl" />
         </button>
       </div>
        <div className="px-6 pt-3 pb-2 flex gap-2 border-b border-outline-variant/20">
          <button
            onClick={() => setTab("users")}
            className={`flex-1 py-2 rounded-full text-label-sm font-medium transition-colors ${
              tab === "users"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Usuarios
         </button>
          <button
            onClick={() => setTab("rooms")}
            className={`flex-1 py-2 rounded-full text-label-sm font-medium transition-colors ${
              tab === "rooms"
                ? "bg-primary text-on-primary"
                : "text-on-surface-variant hover:bg-surface-container-high"
            }`}
          >
            Grupos
         </button>
       </div>
        <div className="px-6 py-3">
          <div className="relative">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-xl text-on-surface-variant"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o correo..."
              autoFocus
              className="w-full bg-surface-container-low rounded-xl pl-10 pr-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none border border-outline-variant/20 focus:border-primary/40 transition-colors"
            />
         </div>
       </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {tab === "users" ? (
            filteredUsers.length === 0 ? (
              <div className="py-12 text-center">
                <MaterialIcon
                  name="person_search"
                  className="text-4xl text-outline-variant mb-2 block mx-auto"
                />
                <p className="text-on-surface-variant text-body-md">
                  No se encontraron usuarios
               </p>
             </div>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => onSelectUser(u.id)}
                  className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-surface-container-high transition-colors"
                >
                  <Avatar
                    src={u.avatar_url}
                    alt={u.name}
                    size="sm"
                    initials={getInitials(u.name)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-medium text-on-surface truncate">
                      {u.name}
                   </p>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      {u.email}
                   </p>
                 </div>
                  {u.house && (
                    <Badge variant="tag" color="secondary">
                      {u.house}
                   </Badge>
                  )}
               </button>
              ))
            )
          ) : roomsLoading ? (
            <div className="py-12 text-center">
              <MaterialIcon
                name="progress_activity"
                className="text-4xl text-outline-variant animate-spin mb-2 block mx-auto"
              />
              <p className="text-on-surface-variant text-body-md">
                Cargando grupos
             </p>
           </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-12 text-center">
              <MaterialIcon
                name="groups"
                className="text-4xl text-outline-variant mb-2 block mx-auto"
              />
              <p className="text-on-surface-variant text-body-md">
                {rooms.length === 0
                  ? "No perteneces a ningun grupo aun"
                  : "No se encontraron grupos"}
             </p>
           </div>
          ) : (
            filteredRooms.map((r) => (
              <button
                key={r.id}
                onClick={() => onSelectRoom(r.id)}
                className="flex items-center gap-3 px-6 py-3 w-full text-left hover:bg-surface-container-high transition-colors"
              >
                <Avatar
                  src={r.avatar_url}
                  alt={r.name}
                  size="sm"
                  initials={getInitials(r.name)}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-body-md font-medium text-on-surface truncate">
                    {r.name}
                 </p>
                  <p className="text-label-sm text-on-surface-variant truncate">
                    {r.member_count} miembros
                 </p>
               </div>
                <MaterialIcon
                  name="groups"
                  className="text-on-surface-variant"
                />
             </button>
            ))
          )}
       </div>
     </div>
   </div>
  );
}

"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { Avatar, Button, MaterialIcon, Modal } from "@/components/ui";
import { api, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { toastError } from "@/lib/toastStore";

interface AllFriendsModalProps {
  userId: string;
  initialFriends: User[];
  isOpen: boolean;
  onClose: () => void;
  onUnfriend?: (userId: string) => void;
}

function initialsOf(name?: string): string {
  return (name ?? "")
    .split(" ")
    .map((n) => n[0])
    .join("");
}

const PAGE_SIZE = 30;
const SEARCH_PAGE = 200;

/** Inner modal content — remounts when `isOpen` toggles (via key on parent)
 * so it always starts with fresh state derived from the latest
 * `initialFriends` passed from the parent page. */
function AllFriendsModalContent({
  userId,
  initialFriends,
  onClose,
  onUnfriend,
}: Omit<AllFriendsModalProps, "isOpen">) {
  const { user: authUser } = useAuthStore();
  const isOwn = authUser?.id === userId;

  const [extras, setExtras] = useState<User[]>([]);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState("");
  const [skip, setSkip] = useState(initialFriends.length);
  const [total, setTotal] = useState(initialFriends.length);
  const [hasMore, setHasMore] = useState(initialFriends.length > PAGE_SIZE);
  const [loading, setLoading] = useState(false);
  const [unfriendTarget, setUnfriendTarget] = useState<User | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search: pull the full friends list and filter client-side.
  useEffect(() => {
    if (!search) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await api.getFriendsPage(userId, {
          skip: 0,
          limit: SEARCH_PAGE,
        });
        setSearchResults(result.items);
      } catch (e) {
        toastError("No se pudieron buscar amigos", e);
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, userId]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore || search) return;
    setLoading(true);
    try {
      const result = await api.getFriendsPage(userId, { skip, limit: PAGE_SIZE });
      setExtras((prev) => [...prev, ...result.items]);
      const newSkip = skip + result.items.length;
      setSkip(newSkip);
      setHasMore(result.has_more);
    } catch (e) {
      toastError("No se pudieron cargar más amigos", e);
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, skip, search, userId]);

  // Infinite scroll observer.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || search) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading) loadMore();
      },
      { rootMargin: "150px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore, search]);

  const filteredFriends = useMemo(() => {
    if (!search) return [...initialFriends, ...extras];
    const q = search.toLowerCase();
    return searchResults.filter((f) => f.name.toLowerCase().includes(q));
  }, [search, initialFriends, extras, searchResults]);

  const filteredTotal = search ? filteredFriends.length : total;

  const handleUnfriendConfirm = async () => {
    if (!unfriendTarget) return;
    try {
      await api.unfriend(unfriendTarget.id);
      setExtras((prev) => prev.filter((f) => f.id !== unfriendTarget.id));
      setTotal((t) => Math.max(0, t - 1));
      onUnfriend?.(unfriendTarget.id);
    } catch (e) {
      toastError("No se pudo eliminar al amigo", e);
    } finally {
      setUnfriendTarget(null);
    }
  };

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
              {filteredTotal} {filteredTotal === 1 ? "amigo" : "amigos"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
            aria-label="Cerrar"
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
          {filteredFriends.length === 0 ? (
            <p className="text-center text-label-sm text-on-surface-variant py-8">
              {search
                ? "No se encontraron amigos"
                : searching
                  ? "Buscando..."
                  : "Sin amigos todavia"}
            </p>
          ) : (
            <div className="space-y-1">
              {filteredFriends.map((f) => (
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
                  {isOwn && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setUnfriendTarget(f);
                      }}
                      className="w-9 h-9 inline-flex items-center justify-center rounded-full text-on-surface-variant hover:bg-error/10 hover:text-error transition-colors"
                      aria-label="Eliminar amigo"
                      title="Eliminar amigo"
                    >
                      <MaterialIcon name="person_remove" className="text-lg" />
                    </button>
                  )}
                  <MaterialIcon
                    name="chevron_right"
                    className="text-outline-variant opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </Link>
              ))}
            </div>
          )}
          {!search && hasMore && (
            <>
              <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
              {loading && (
                <p className="text-center text-label-sm text-on-surface-variant py-2">
                  Cargando...
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {unfriendTarget && (
        <Modal
          open
          onClose={() => setUnfriendTarget(null)}
          title="Eliminar amigo"
          size="sm"
        >
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 inline-flex items-center justify-center rounded-full bg-error/10 text-error shrink-0">
                <MaterialIcon name="person_remove" className="text-xl" />
              </div>
              <p className="text-body-md text-on-surface-variant">
                ¿Seguro que deseas eliminar a{" "}
                <span className="font-semibold text-on-surface">
                  {unfriendTarget.name}
                </span>{" "}
                de tus amigos?
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setUnfriendTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon="person_remove"
                onClick={handleUnfriendConfirm}
              >
                Eliminar
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export function AllFriendsModal({
  userId,
  initialFriends,
  isOpen,
  onClose,
  onUnfriend,
}: AllFriendsModalProps) {
  if (!isOpen) return null;
  // Key on `userId` + `isOpen` so the content fully remounts when either
  // changes, giving it a clean slate with the latest `initialFriends`.
  return (
    <AllFriendsModalContent
      key={`${userId}:${isOpen}`}
      userId={userId}
      initialFriends={initialFriends}
      onClose={onClose}
      onUnfriend={onUnfriend}
    />
  );
}
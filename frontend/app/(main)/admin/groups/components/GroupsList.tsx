"use client";

import type { ChatRoomBrief } from "@/lib/api";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import ListFooter from "@/components/ui/ListFooter";

export function GroupsList({
  rooms,
  loading,
  hasMore,
  loadingMore,
  totalCount,
  totalLoaded,
  search,
  onSearchChange,
  onToggleClose,
  onEdit,
  onMembers,
  onDelete,
  onLoadMore,
}: {
  rooms: ChatRoomBrief[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  totalCount: number;
  totalLoaded: number;
  search: string;
  onSearchChange: (s: string) => void;
  onToggleClose: (id: string) => Promise<void>;
  onEdit: (room: ChatRoomBrief) => void;
  onMembers: (room: ChatRoomBrief) => void;
  onDelete: (id: string) => void;
  onLoadMore: () => void;
}) {
  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("es-ES", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="glass-card rounded-xl overflow-hidden">
      <div className="p-4 border-b border-outline-variant/20">
        <input
          type="text"
          placeholder="Buscar grupos..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
        />
      </div>

      {/* MOBILE: Cards */}
      <div className="md:hidden divide-y divide-outline-variant/10">
        {loading ? (
          <div className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
              <p className="text-on-surface-variant text-body-md">Cargando grupos...</p>
            </div>
          </div>
        ) : rooms.length === 0 ? (
          <div className="p-12 text-center">
            <MaterialIcon name="groups" className="text-5xl text-outline-variant mb-3 block mx-auto" />
            <p className="text-on-surface-variant text-body-md">
              {search ? "Sin resultados" : "No hay grupos creados aún"}
            </p>
          </div>
        ) : (
          <>
            {rooms.map((room) => (
              <div key={room.id} className="p-4 hover:bg-surface-container-low/50 transition-colors border-b border-outline-variant/10 last:border-0">
                <div className="flex items-start gap-3">
                  <Avatar src={room.avatar_url ?? undefined} alt={room.name} size="sm" initials={getInitials(room.name)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface font-medium truncate">{room.name}</p>
{room.description && (
                      <p className="text-label-sm text-on-surface-variant truncate">{room.description ?? ""}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Badge variant="count">{room.member_count}</Badge>
                      <span className="text-label-sm text-on-surface-variant">miembros</span>
                      {room.closed ? (
                        <Badge variant="tag" color="error">
                          <MaterialIcon name="lock" className="text-xs mr-1" />
                          Cerrado
                        </Badge>
                      ) : (
                        <Badge variant="tag" color="success">
                          <MaterialIcon name="lock_open" className="text-xs mr-1" />
                          Abierto
                        </Badge>
                      )}
                    </div>
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      Creado por {room.creator_name ?? room.created_by.slice(0, 8)} · {formatDate(room.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-1 mt-3">
                  <button
                    onClick={() => onToggleClose(room.id)}
                    className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
                      room.closed
                        ? "hover:bg-green-100 text-green-600"
                        : "hover:bg-amber-100 text-amber-600"
                    }`}
                    title={room.closed ? "Reabrir grupo" : "Cerrar grupo"}
                  >
                    <MaterialIcon name={room.closed ? "lock_open" : "lock"} className="text-lg" />
                  </button>
                  <button onClick={() => onEdit(room)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Editar">
                    <MaterialIcon name="edit" className="text-lg" />
                  </button>
                  <button onClick={() => onMembers(room)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Miembros">
                    <MaterialIcon name="group" className="text-lg" />
                  </button>
                  <button onClick={() => onDelete(room.id)} className="w-10 h-10 inline-flex items-center justify-center rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                    <MaterialIcon name="delete" className="text-lg" />
                  </button>
                </div>
              </div>
            ))}
            <div className="p-2">
              <ListFooter
                hasMore={hasMore}
                loading={loadingMore}
                pageSize={10}
                loaded={totalLoaded}
                total={totalCount}
                onLoadMore={onLoadMore}
              />
            </div>
          </>
        )}
      </div>

      {/* DESKTOP: Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-surface-container">
            <tr className="border-b border-outline-variant/20">
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">Grupo</th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">Miembros</th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Estado</th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Creador</th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden lg:table-cell">Creado</th>
              <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right pr-6">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <MaterialIcon name="progress_activity" className="text-4xl text-outline-variant animate-spin mb-3" />
                    <p className="text-on-surface-variant text-body-md">Cargando grupos...</p>
                  </div>
                </td>
              </tr>
            ) : rooms.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center">
                  <MaterialIcon name="groups" className="text-5xl text-outline-variant mb-3 block mx-auto" />
                  <p className="text-on-surface-variant text-body-md">
                    {search ? "Sin resultados" : "No hay grupos creados aún"}
                  </p>
                </td>
              </tr>
            ) : (
              rooms.map((room) => (
                <tr key={room.id} className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar src={room.avatar_url ?? undefined} alt={room.name} size="sm" initials={getInitials(room.name)} />
                      <div className="min-w-0">
                        <p className="text-body-md text-on-surface truncate max-w-xs">{room.name}</p>
{room.description && (
                          <p className="text-label-sm text-on-surface-variant truncate max-w-xs">{room.description ?? ""}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <Badge variant="count">{room.member_count}</Badge>
                    <span className="text-label-sm text-on-surface-variant ml-2">miembros</span>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    {room.closed ? (
                      <Badge variant="tag" color="error">
                        <MaterialIcon name="lock" className="text-xs mr-1" />
                        Cerrado
                      </Badge>
                    ) : (
                      <Badge variant="tag" color="success">
                        <MaterialIcon name="lock_open" className="text-xs mr-1" />
                        Abierto
                      </Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <p className="text-label-sm text-on-surface-variant">
                      {room.creator_name ?? room.created_by.slice(0, 8)}
                    </p>
                  </td>
                  <td className="px-6 py-4 hidden lg:table-cell">
                    <p className="text-label-sm text-on-surface-variant">{formatDate(room.created_at)}</p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => onToggleClose(room.id)}
                        className={`p-2 rounded-full transition-colors ${
                          room.closed
                            ? "hover:bg-green-100 text-green-600"
                            : "hover:bg-amber-100 text-amber-600"
                        }`}
                        title={room.closed ? "Reabrir grupo" : "Cerrar grupo"}
                      >
                        <MaterialIcon name={room.closed ? "lock_open" : "lock"} className="text-lg" />
                      </button>
                      <button onClick={() => onEdit(room)} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Editar">
                        <MaterialIcon name="edit" className="text-lg" />
                      </button>
                      <button onClick={() => onMembers(room)} className="p-2 rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors" title="Miembros">
                        <MaterialIcon name="group" className="text-lg" />
                      </button>
                      <button onClick={() => onDelete(room.id)} className="p-2 rounded-full hover:bg-error-container text-error transition-colors" title="Eliminar">
                        <MaterialIcon name="delete" className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="hidden md:block p-4 border-t border-outline-variant/20">
        <ListFooter
          hasMore={hasMore}
          loading={loadingMore}
          pageSize={10}
          loaded={totalLoaded}
          total={totalCount}
          onLoadMore={onLoadMore}
        />
      </div>
    </div>
  );
}
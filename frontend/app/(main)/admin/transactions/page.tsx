"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { api, Transaction, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useRouter } from "next/navigation";
import GlassCard from "@/components/ui/GlassCard";
import SearchBar from "@/components/ui/SearchBar";
import Avatar from "@/components/ui/Avatar";
import ListFooter from "@/components/ui/ListFooter";
import { MaterialIcon } from "@/components/ui";
import { useDebounce } from "@/hooks/useDebounce";
import { usePaginatedList } from "@/hooks/usePaginatedList";

function formatAmount(amount: number) {
  return amount.toLocaleString();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function txIcon(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return { icon: "arrow_downward", color: "bg-success/10 text-success" };
    case "withdrawal":
      return { icon: "arrow_upward", color: "bg-error/10 text-error" };
    case "transfer":
      return { icon: "swap_horiz", color: "bg-primary/10 text-primary" };
    case "purchase":
      return { icon: "shopping_cart", color: "bg-secondary/10 text-secondary" };
    default:
      return { icon: "receipt_long", color: "bg-surface-container-high text-on-surface-variant" };
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const TX_TYPE_LABELS: Record<Transaction["type"], string> = {
  deposit: "Depósito",
  withdrawal: "Retiro",
  transfer: "Transferencia",
  purchase: "Compra",
};

function txTypeLabel(type: Transaction["type"]): string {
  return TX_TYPE_LABELS[type] ?? type;
}

function getActorName(tx: Transaction): string {
  if (tx.type === "deposit") {
    return tx.receiver?.name || (tx.receiver_id ? "Desconocido" : "—");
  }
  if (tx.type === "withdrawal" || tx.type === "purchase") {
    return tx.sender?.name || (tx.sender_id ? "Desconocido" : "—");
  }
  if (tx.type === "transfer") {
    const sender = tx.sender?.name || (tx.sender_id ? "Desconocido" : "—");
    const receiver = tx.receiver?.name || (tx.receiver_id ? "Desconocido" : "—");
    return `${sender} → ${receiver}`;
  }
  return "—";
}

function getActorAvatar(tx: Transaction): string | undefined {
  if (tx.type === "deposit") {
    return tx.receiver?.avatar_url;
  }
  if (tx.type === "transfer") {
    return tx.sender?.avatar_url;
  }
  return tx.sender?.avatar_url;
}

export default function AdminTransactionsPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [filter, setFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"user" | "admin">("admin");
  
  // New filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [userFilterQuery, setUserFilterQuery] = useState("");
  const [userFilterResults, setUserFilterResults] = useState<User[]>([]);
  const [selectedUserFilter, setSelectedUserFilter] = useState<User | null>(null);
  const [userFilterSearching, setUserFilterSearching] = useState(false);
  const userFilterQueryRef = useRef("");

  useEffect(() => {
    userFilterQueryRef.current = userFilterQuery;
  }, [userFilterQuery]);

  // User filter search effect (similar to TransferTab)
  useEffect(() => {
    if (!userFilterQuery || userFilterQuery.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setUserFilterSearching(true);
      api
        .searchUsersServer(userFilterQuery, { limit: 20 })
        .then((page) => {
          if (userFilterQueryRef.current !== userFilterQuery) return;
          setUserFilterResults(page.items);
        })
        .catch(() => {
          if (userFilterQueryRef.current === userFilterQuery) {
            setUserFilterResults([]);
          }
        })
        .finally(() => {
          if (userFilterQueryRef.current === userFilterQuery) setUserFilterSearching(false);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [userFilterQuery]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Build filter object for API calls
  const buildFilters = useCallback(() => ({
    type: filter === "all" ? undefined : filter,
    userId: selectedUserFilter?.id,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  }), [filter, selectedUserFilter, dateFrom, dateTo]);

  const userTransactions = usePaginatedList({
    fetcher: (p) => api.getTransactions(p, buildFilters()),
    pageSize: 15,
    enabled: true,
    queryKey: ["admin-transactions-user"],
    resetKey: [filter, activeTab, selectedUserFilter?.id, dateFrom, dateTo],
  });

  const adminTransactions = usePaginatedList({
    fetcher: (p) => api.getAllTransactionsAdmin(p, buildFilters()),
    pageSize: 15,
    enabled: user?.role === "admin" && activeTab === "admin",
    queryKey: ["admin-transactions-all"],
    resetKey: [filter, activeTab, selectedUserFilter?.id, dateFrom, dateTo],
  });

  // Only the active tab should load data
  const userLoading = activeTab === "user" ? userTransactions.loading : false;
  const adminLoading = activeTab === "admin" ? adminTransactions.loading : false;

  const filterTx = (tx: Transaction) => {
    const actorName = getActorName(tx);
    return (
      !search ||
      tx.description?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      actorName.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      tx.sender?.email?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      tx.receiver?.email?.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  };

  const filteredUser = userTransactions.items.filter(filterTx);
  const filteredAdmin = adminTransactions.items.filter(filterTx);

  const visibleUser = filteredUser;
  const visibleAdmin = filteredAdmin;
  const loading = activeTab === "user" ? userLoading : adminLoading;
  const visibleTx = activeTab === "user" ? visibleUser : visibleAdmin;
  const filtered = activeTab === "user" ? filteredUser : filteredAdmin;

  // Only calculate stats from loaded admin transactions
  const weekTransactions = useMemo(() => {
    const now = new Date();
    const dayOfWeek = (now.getDay() + 6) % 7;
    const startOfWeek = new Date(now);
    startOfWeek.setHours(0, 0, 0, 0);
    startOfWeek.setDate(now.getDate() - dayOfWeek);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    return adminTransactions.items.filter((t) => {
      const d = new Date(t.created_at);
      return d >= startOfWeek && d < endOfWeek;
    });
  }, [adminTransactions.items]);

  const totalDeposits = weekTransactions
    .filter((t) => t.type === "deposit")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalWithdrawals = weekTransactions
    .filter((t) => t.type === "withdrawal")
    .reduce((sum, t) => sum + t.amount, 0);
  const totalTransfers = weekTransactions
    .filter((t) => t.type === "transfer")
    .reduce((sum, t) => sum + t.amount, 0);

  if (user?.role !== "admin") return null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-headline-lg text-on-surface">
            Transacciones
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            Historial completo de transacciones del sistema
          </p>
        </div>
        <div className="w-full md:w-80">
          <SearchBar
            placeholder="Buscar transacciones..."
            value={search}
            onChange={setSearch}
            size="md"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["user", "admin"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
              activeTab === tab
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {tab === "user" ? "Mis transacciones" : "Todas las transacciones"}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <GlassCard glow>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center text-success">
              <MaterialIcon name="arrow_downward" className="text-2xl" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Depósitos (semana)
              </p>
              <p className="font-display text-title-md text-success">
                +{formatAmount(totalDeposits)}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard glow>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center text-error">
              <MaterialIcon name="arrow_upward" className="text-2xl" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Retiros (semana)
              </p>
              <p className="font-display text-title-md text-error">
                -{formatAmount(totalWithdrawals)}
              </p>
            </div>
          </div>
        </GlassCard>
        <GlassCard glow>
          <div className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MaterialIcon name="swap_horiz" className="text-2xl" />
            </div>
            <div>
              <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                Transferencias (semana)
              </p>
              <p className="font-display text-title-md text-primary">
                {formatAmount(totalTransfers)}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

{/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Type filter */}
        <div className="flex flex-wrap gap-2">
          {["all", "deposit", "withdrawal", "transfer", "purchase"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
                filter === f
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
              }`}
            >
              {f === "all"
                ? "Todas"
                : f === "deposit"
                ? "Depósitos"
                : f === "withdrawal"
                ? "Retiros"
                : f === "transfer"
                ? "Transferencias"
                : "Compras"}
            </button>
          ))}
        </div>

        {/* Date range filter */}
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Desde:</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-40 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-sm"
          />
          <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Hasta:</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-40 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-sm"
          />
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="px-3 py-2 rounded-full text-label-sm font-medium bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all"
            >
              <MaterialIcon name="close" className="text-sm" />
            </button>
          )}
        </div>

        {/* User filter */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <label className="sr-only">Filtrar por usuario</label>
          <div className="relative">
            <input
              type="text"
              value={userFilterQuery}
              onChange={(e) => {
                setUserFilterQuery(e.target.value);
                if (!e.target.value) setSelectedUserFilter(null);
              }}
              placeholder="Buscar usuario..."
              className="w-full px-4 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-sm pr-10"
            />
            {(userFilterQuery.length >= 2 && (userFilterSearching || userFilterResults.length > 0)) && (
              <div className="absolute top-full left-0 right-0 mt-1 z-20 glass-card rounded-xl shadow-lg border border-outline-variant/20 max-h-60 overflow-auto">
                {userFilterSearching && (
                  <div className="px-4 py-3 text-center text-on-surface-variant text-body-sm">
                    <MaterialIcon name="search" className="animate-spin inline-block mr-2" />
                    Buscando...
                  </div>
                )}
                {userFilterResults.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      setSelectedUserFilter(u);
                      setUserFilterQuery(u.name);
                      setUserFilterResults([]);
                    }}
                    className="w-full px-4 py-2.5 hover:bg-surface-container-highest flex items-center gap-3 text-left"
                  >
                    <Avatar
                      initials={u.name.charAt(0).toUpperCase()}
                      src={u.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface truncate">{u.name}</p>
                      <p className="text-label-sm text-on-surface-variant truncate">{u.email}</p>
                    </div>
                  </button>
                ))}
                {userFilterResults.length === 0 && userFilterQuery.length >= 2 && !userFilterSearching && (
                  <div className="px-4 py-3 text-center text-on-surface-variant text-body-sm">
                    No se encontraron usuarios
                  </div>
                )}
              </div>
            )}
            {selectedUserFilter && (
              <button
                type="button"
                onClick={() => {
                  setSelectedUserFilter(null);
                  setUserFilterQuery("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-highest transition-colors"
                aria-label="Limpiar filtro de usuario"
              >
                <MaterialIcon name="close" className="text-on-surface-variant text-lg" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-full bg-outline-variant/30" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-outline-variant/30 rounded w-1/3" />
                  <div className="h-3 bg-outline-variant/30 rounded w-1/4" />
                </div>
                <div className="h-5 bg-outline-variant/30 rounded w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* MOBILE: Cards */}
          <div className="md:hidden space-y-3">
            {visibleTx.map((tx) => {
              const { icon, color } = txIcon(tx.type);
              const isTransfer = tx.type === "transfer";
              const amountPrefix = tx.type === "deposit" ? "+" : (tx.type === "withdrawal" || tx.type === "purchase") ? "-" : "";
              const amountColor = tx.type === "deposit" ? "text-success" : (tx.type === "withdrawal" || tx.type === "purchase") ? "text-error" : "text-on-surface";
              return (
                <GlassCard key={tx.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}
                    >
                      <MaterialIcon name={icon} className="text-xl" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-body-md font-medium text-on-surface">
                          {txTypeLabel(tx.type)}
                        </p>
                        <p className={`font-display text-title-md shrink-0 ${amountColor}`}>
                          {amountPrefix}
                          {formatAmount(tx.amount)}
                        </p>
                      </div>
                      <div className="mt-2">
                        {isTransfer && tx.sender && tx.receiver ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-label-sm text-on-surface-variant w-10 shrink-0">De:</span>
                              <Avatar
                                initials={tx.sender.name.charAt(0).toUpperCase()}
                                src={tx.sender.avatar_url}
                                size="sm"
                              />
                              <p className="text-body-sm text-on-surface truncate">
                                {tx.sender.name}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-label-sm text-on-surface-variant w-10 shrink-0">Para:</span>
                              <p className="text-body-sm text-on-surface truncate">
                                {tx.receiver.name}
                              </p>
                              <Avatar
                                initials={tx.receiver.name.charAt(0).toUpperCase()}
                                src={tx.receiver.avatar_url}
                                size="sm"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <Avatar
                              initials={getInitials(getActorName(tx))}
                              src={getActorAvatar(tx)}
                              size="sm"
                            />
                            <p className="text-body-sm text-on-surface truncate">
                              {getActorName(tx)}
                            </p>
                          </div>
                        )}
                      </div>
                      {tx.description && (
                        <p className="text-label-sm text-on-surface-variant truncate mt-1">
                          {tx.description}
                        </p>
                      )}
                      <p className="text-label-sm text-on-surface-variant mt-1">
                        {formatTime(tx.created_at)}
                      </p>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
            {filtered.length === 0 && (
              <GlassCard className="p-12 text-center">
                <MaterialIcon
                  name="receipt_long"
                  className="text-5xl text-outline-variant mb-3 block mx-auto"
                />
                  <p className="text-on-surface-variant text-body-md">
                    No hay transacciones
                  </p>
                </GlassCard>
              )}
            {activeTab === "user" ? (
              <ListFooter
                hasMore={userTransactions.hasMore}
                loading={userTransactions.loadingMore}
                pageSize={15}
                loaded={userTransactions.totalLoaded}
                total={userTransactions.totalCount}
                onLoadMore={userTransactions.loadMore}
              />
            ) : (
              <ListFooter
                hasMore={adminTransactions.hasMore}
                loading={adminTransactions.loadingMore}
                pageSize={15}
                loaded={adminTransactions.totalLoaded}
                total={adminTransactions.totalCount}
                onLoadMore={adminTransactions.loadMore}
              />
            )}
          </div>

          {/* DESKTOP: Table */}
          <GlassCard className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="sticky top-0 z-10 bg-surface-container">
                  <tr className="border-b border-outline-variant/20">
                    <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium">
                      Tipo
                    </th>
                    <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                      Usuario
                    </th>
                    <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden md:table-cell">
                      Descripción
                    </th>
                    <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium hidden sm:table-cell">
                      Fecha
                    </th>
                    <th className="text-label-sm text-on-surface-variant uppercase tracking-wider px-6 py-4 font-medium text-right">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleTx.map((tx) => {
                    const { icon, color } = txIcon(tx.type);
                    const amountPrefix = tx.type === "deposit" ? "+" : (tx.type === "withdrawal" || tx.type === "purchase") ? "-" : "";
                    const amountColor = tx.type === "deposit" ? "text-success" : (tx.type === "withdrawal" || tx.type === "purchase") ? "text-error" : "text-on-surface";
                    return (
                      <tr
                        key={tx.id}
                        className="border-b border-outline-variant/10 last:border-0 hover:bg-surface-container-low/50 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${color}`}
                            >
                              <MaterialIcon name={icon} className="text-lg" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-body-md text-on-surface">
                                {txTypeLabel(tx.type)}
                              </p>
                              <p className="text-label-sm text-on-surface-variant md:hidden truncate max-w-[200px]">
                                {tx.description || "-"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          {tx.type === "transfer" && tx.sender && tx.receiver ? (
                            <div className="flex items-center gap-1">
                              <Avatar
                                initials={tx.sender.name.charAt(0).toUpperCase()}
                                src={tx.sender.avatar_url}
                                size="sm"
                              />
                              <MaterialIcon
                                name="arrow_forward"
                                className="text-outline-variant text-sm"
                              />
                              <Avatar
                                initials={tx.receiver.name.charAt(0).toUpperCase()}
                                src={tx.receiver.avatar_url}
                                size="sm"
                              />
                              <span className="text-label-sm text-on-surface-variant ml-1">
                                {tx.sender.name} → {tx.receiver.name}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Avatar
                                initials={getInitials(getActorName(tx))}
                                src={getActorAvatar(tx)}
                                size="sm"
                              />
                              <p className="text-body-md text-on-surface truncate max-w-[150px]">
                                {getActorName(tx)}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 hidden md:table-cell">
                          <p className="text-label-sm text-on-surface-variant truncate max-w-[200px]">
                            {tx.description || "—"}
                          </p>
                        </td>
                        <td className="px-6 py-4 hidden sm:table-cell">
                          <p className="text-label-sm text-on-surface-variant">
                            {formatTime(tx.created_at)}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <p className={`font-display text-title-md ${amountColor}`}>
                            {amountPrefix}
                            {formatAmount(tx.amount)}
                          </p>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <MaterialIcon
                          name="receipt_long"
                          className="text-5xl text-outline-variant mb-3 block mx-auto"
                        />
                        <p className="text-on-surface-variant text-body-md">
                          No hay transacciones
                        </p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {activeTab === "user" ? (
              <ListFooter
                hasMore={userTransactions.hasMore}
                loading={userTransactions.loadingMore}
                pageSize={15}
                loaded={userTransactions.totalLoaded}
                total={userTransactions.totalCount}
                onLoadMore={userTransactions.loadMore}
              />
            ) : (
              <ListFooter
                hasMore={adminTransactions.hasMore}
                loading={adminTransactions.loadingMore}
                pageSize={15}
                loaded={adminTransactions.totalLoaded}
                total={adminTransactions.totalCount}
                onLoadMore={adminTransactions.loadMore}
              />
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}
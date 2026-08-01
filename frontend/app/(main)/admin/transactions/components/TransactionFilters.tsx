"use client";

import { User } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui";
import { TxTypeFilter } from "../types";

const TYPE_CHIPS: { value: TxTypeFilter; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "deposit", label: "Depósitos" },
  { value: "withdrawal", label: "Retiros" },
  { value: "transfer", label: "Transferencias" },
  { value: "purchase", label: "Compras" },
];

interface TransactionFiltersProps {
  filter: TxTypeFilter;
  setFilter: (f: TxTypeFilter) => void;
  dateFrom: string;
  setDateFrom: (v: string) => void;
  dateTo: string;
  setDateTo: (v: string) => void;
  clearDateRange: () => void;
  userFilterQuery: string;
  setUserFilterQuery: (v: string) => void;
  selectedUserFilter: User | null;
  userFilterResults: User[];
  userFilterSearching: boolean;
  clearUserFilter: () => void;
  selectUserFilter: (u: User) => void;
}

export default function TransactionFilters({
  filter,
  setFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  clearDateRange,
  userFilterQuery,
  setUserFilterQuery,
  selectedUserFilter,
  userFilterResults,
  userFilterSearching,
  clearUserFilter,
  selectUserFilter,
}: TransactionFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Type filter */}
      <div className="flex flex-wrap gap-2">
        {TYPE_CHIPS.map((chip) => (
          <button
            key={chip.value}
            onClick={() => setFilter(chip.value)}
            className={`px-4 py-2 rounded-full text-label-sm font-medium whitespace-nowrap transition-all ${
              filter === chip.value
                ? "bg-primary text-on-primary"
                : "bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest"
            }`}
          >
            {chip.label}
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
            onClick={clearDateRange}
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
              if (!e.target.value) clearUserFilter();
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
                  onClick={() => selectUserFilter(u)}
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
              onClick={clearUserFilter}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-surface-container-highest transition-colors"
              aria-label="Limpiar filtro de usuario"
            >
              <MaterialIcon name="close" className="text-on-surface-variant text-lg" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
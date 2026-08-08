"use client";

import { MaterialIcon } from "@/components/ui";
import SearchBar from "@/components/ui/SearchBar";

interface ConsumicionFiltersProps {
  search: string;
  onSearchChange: (value: string) => void;
  dateFrom: string;
  onDateFromChange: (value: string) => void;
  dateTo: string;
  onDateToChange: (value: string) => void;
  onClearFilters: () => void;
}

export default function ConsumicionFilters({
  search,
  onSearchChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  onClearFilters,
}: ConsumicionFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="flex-1 min-w-[200px] max-w-md">
        <SearchBar
          placeholder="Buscar usuario, email o producto..."
          value={search}
          onChange={onSearchChange}
          size="md"
          variant="light"
        />
      </div>

      <div className="hidden md:flex flex-wrap items-center gap-2">
        <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Desde:</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-40 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-sm"
        />
        <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Hasta:</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-40 px-3 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-sm"
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={onClearFilters}
            className="px-3 py-2 rounded-full text-label-sm font-medium bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all"
          >
            <MaterialIcon name="close" className="text-sm" />
          </button>
        )}
      </div>

      <div className="flex md:hidden items-center gap-1.5">
        <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Desde:</label>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="w-0 flex-1 min-w-0 px-2 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-xs"
        />
        <label className="text-label-sm text-on-surface-variant whitespace-nowrap">Hasta:</label>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="w-0 flex-1 min-w-0 px-2 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant/20 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary text-body-xs"
        />
        {(dateFrom || dateTo) && (
          <button
            type="button"
            onClick={onClearFilters}
            className="px-1.5 py-1.5 rounded-full text-label-sm font-medium bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest transition-all shrink-0"
          >
            <MaterialIcon name="close" className="text-sm" />
          </button>
        )}
      </div>
    </div>
  );
}
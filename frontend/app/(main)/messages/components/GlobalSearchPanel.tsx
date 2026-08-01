"use client";

import { Message } from "@/lib/api";
import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "../helpers";

export default function GlobalSearchPanel({
  query,
  onQueryChange,
  results,
  onSelectResult,
}: {
  query: string;
  onQueryChange: (val: string) => void;
  results: Message[];
  onSelectResult: (msg: Message) => void;
}) {
  return (
    <div className="mt-3 space-y-2">
      <SearchBar
        placeholder="Buscar en todos los mensajes..."
        value={query}
        onChange={onQueryChange}
        size="sm"
      />
      {results.length > 0 && (
        <div className="max-h-48 overflow-y-auto space-y-1">
          {results.map((msg) => (
            <button
              key={msg.id}
              onClick={() => onSelectResult(msg)}
              className="w-full text-left p-2 rounded-lg hover:bg-surface-container-high transition-colors flex items-center gap-2"
            >
              <div className="flex-1 min-w-0">
                <p className="text-label-sm font-medium text-on-surface truncate">
                  {msg.sender?.name || "Alguien"}
                </p>
                <p className="text-label-sm text-on-surface-variant truncate">
                  {msg.body?.slice(0, 60) || "Adjunto"}
                </p>
              </div>
              <MaterialIcon name="chevron_right" className="text-on-surface-variant" />
            </button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <p className="text-center text-on-surface-variant text-label-sm py-4">
          {`Sin resultados para "${query}"`}
        </p>
      )}
    </div>
  );
}
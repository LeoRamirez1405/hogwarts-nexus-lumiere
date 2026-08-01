"use client";

import { SearchBar } from "@/components/ui";
import { MaterialIcon } from "../helpers";
import type { Message } from "@/lib/api";

interface InChatSearchPanelProps {
  value: string;
  onChange: (value: string) => void;
  results: Message[];
  onSelectResult: (msg: Message) => void;
  onClose: () => void;
}

export default function InChatSearchPanel({
  value,
  onChange,
  results,
  onSelectResult,
  onClose,
}: InChatSearchPanelProps) {
  return (
    <div className="border-b border-outline-variant/20 bg-surface-container-low p-3">
      <div className="flex items-center gap-2">
        <SearchBar
          placeholder="Buscar en esta conversacion..."
          value={value}
          onChange={onChange}
          size="sm"
          className="flex-1"
        />
        <button
          onClick={onClose}
          className="w-9 h-9 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant transition-colors"
          title="Cerrar busqueda"
        >
          <MaterialIcon name="close" className="text-xl" />
        </button>
      </div>
      {results.length > 0 && (
        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
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
      {value && results.length === 0 && (
        <p className="text-center text-on-surface-variant text-label-sm py-4">
          {`Sin resultados para "${value}"`}
        </p>
      )}
    </div>
  );
}

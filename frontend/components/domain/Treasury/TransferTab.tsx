"use client";

import { useEffect, useRef, useState } from "react";
import { api, User } from "@/lib/api";
import { Button, SearchBar, MaterialIcon } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface TransferTabProps {
  balance: number;
  onDone: () => void | Promise<void>;
  applyOptimisticBalance: (delta: number) => () => void;
  onErrorRollback: () => void | Promise<void>;
}

export function TransferTab({ balance, onDone, applyOptimisticBalance, onErrorRollback }: TransferTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const queryRef = useRef("");

  const parsed = parseInt(amount, 10) || 0;
  const invalidAmount = !amount || parsed <= 0 || !Number.isInteger(parsed);
  const insufficient = parsed > balance;

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!query || query.length < 2) {
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .searchUsersServer(query, { limit: 20 })
        .then((page) => {
          if (queryRef.current !== query) return;
          setResults(page.items);
        })
        .catch((e) => {
          if (queryRef.current === query) {
            setResults([]);
            toastError("No se pudo buscar usuarios", e);
          }
        })
        .finally(() => {
          if (queryRef.current === query) setSearching(false);
        });
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) {
      setError("Selecciona un destinatario");
      return;
    }
    if (!parsed || parsed <= 0 || !Number.isInteger(parsed)) {
      setError("Ingrese una cantidad valida");
      return;
    }
    if (insufficient) {
      setError("Saldo insuficiente en la bóveda");
      return;
    }
    if (!description.trim()) {
      setError("La descripcion es obligatoria");
      return;
    }
    if (description.length > 500) {
      setError("La descripcion no puede exceder 500 caracteres");
      return;
    }
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    const revert = applyOptimisticBalance(-parsed);
    try {
      await api.transfer(selected.id, parsed, description.trim());
      setAmount("");
      setDescription("");
      setQuery("");
      setSelected(null);
      setResults([]);
      setConfirming(false);
      toastSuccess("Transferencia realizada", `${parsed.toLocaleString()} Zerines enviados a ${selected.name}`);
      await onDone();
    } catch (err: unknown) {
      revert();
      await onErrorRollback();
      setConfirming(false);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      toastError("No se pudo completar la transferencia", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {!selected ? (
        <div className="space-y-3">
          <SearchBar
            placeholder="Buscar usuario por nombre o email..."
            value={query}
            onChange={(v) => {
              setQuery(v);
              if (!v || v.length < 2) setResults([]);
            }}
            size="md"
          />
          {searching && (
            <p className="text-on-surface-variant text-label-sm text-center">
              Buscando...
            </p>
          )}
          {results.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
              {results.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    setSelected(u);
                    setQuery("");
                    setResults([]);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-surface-container-high transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface font-medium truncate">
                      {u.name}
                    </p>
                    <p className="text-label-sm text-on-surface-variant truncate">
                      {u.email}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-4 bg-surface-container-low rounded-xl px-6 py-3">
          <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md">
            {selected.name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-body-md text-on-surface font-medium truncate">
              {selected.name}
            </p>
            <p className="text-label-sm text-on-surface-variant truncate">
              {selected.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-on-surface-variant hover:text-error transition-colors"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>
      )}

      <div className="text-center">
        <div className="font-display text-5xl text-on-surface flex items-center justify-center gap-3">
          <MaterialIcon name="diamond" className="text-4xl" filled />
          <input
            type="number"
            min="1"
            step="1"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
              setConfirming(false);
            }}
            className="w-48 bg-transparent outline-none text-center font-display text-5xl text-on-surface placeholder:text-outline-variant/40 border-b-2 border-outline-variant/30 focus:border-primary transition-colors"
          />
        </div>
        <p className="text-label-sm text-on-surface-variant mt-3 uppercase tracking-wider">
          Zerines a transferir
        </p>
      </div>

      {insufficient && parsed > 0 && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Saldo insuficiente. Tu balance es de {balance.toLocaleString()} Zerines.
          </span>
        </div>
      )}

      {invalidAmount && amount !== "" && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Ingresa una cantidad valida mayor a 0.
          </span>
        </div>
      )}

      <div>
        <input
          type="text"
          maxLength={500}
          placeholder="Descripcion"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(null);
          }}
          className="w-full px-6 py-3 rounded-full bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
        />
        <div className="flex justify-end mt-1">
          <span className="text-label-sm text-on-surface-variant">
            {description.length}/500
          </span>
        </div>
      </div>

      {error && (
        <p className="text-error text-body-md text-center">{error}</p>
      )}

      <div className="text-center">
        {confirming ? (
          <div className="inline-flex flex-col items-center gap-3">
            <p className="text-body-md text-on-surface-variant">
              ¿Confirmar transferencia de{" "}
              <span className="font-bold text-on-surface">{parsed.toLocaleString()}</span>{" "}
              Zerines a <span className="font-bold text-on-surface">{selected?.name}</span>?
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="crystal"
                size="lg"
                icon="send"
                disabled={submitting}
              >
                {submitting ? "Enviando..." : "Sí, confirmar"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setConfirming(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="submit"
            variant="crystal"
            size="lg"
            icon="send"
            disabled={submitting || invalidAmount || !selected || insufficient || !description.trim()}
          >
            {submitting ? "Enviando..." : "Transferir Zerines"}
          </Button>
        )}
      </div>
    </form>
  );
}
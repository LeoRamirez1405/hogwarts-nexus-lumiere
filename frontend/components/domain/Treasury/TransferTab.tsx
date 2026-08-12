"use client";

import { useMemo, useEffect, useState, useCallback } from "react";
import { api, User } from "@/lib/api";
import { Button, SearchBar, MaterialIcon, NumberStepper } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuthStore } from "@/lib/authStore";

interface TransferTabProps {
  balance: number;
  onDone: () => void | Promise<void>;
  applyOptimisticBalance: (delta: number) => () => void;
  onErrorRollback: () => void | Promise<void>;
}

type SelectedMap = Record<string, User>;

export function TransferTab({
  balance,
  onDone,
  applyOptimisticBalance,
  onErrorRollback,
}: TransferTabProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<SelectedMap>({});
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [friends, setFriends] = useState<User[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [showList, setShowList] = useState(false);

  const { user: authUser } = useAuthStore();
  const debouncedQuery = useDebounce(query, 400);

  const parsed = parseInt(amount, 10) || 0;
  const invalidAmount = !amount || parsed <= 0 || !Number.isInteger(parsed);
  const insufficient = parsed > balance;
  const selectedIds = Object.keys(selected);
  const hasAnySelected = selectedIds.length > 0;

  const resolvedResults = useMemo(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return [];
    return results;
  }, [debouncedQuery, results]);

  const loadFriends = useCallback(async () => {
    if (!authUser) return;
    setLoadingFriends(true);
    try {
      const page = await api.getFriendsPage(authUser.id, { limit: 60 });
      setFriends(page.items);
    } catch (e) {
      toastError("No se pudieron cargar los amigos", e);
      setFriends([]);
    } finally {
      setLoadingFriends(false);
    }
  }, [authUser]);

  const handleFocus = useCallback(() => {
    setShowList(true);
    if (!query && friends.length === 0 && !loadingFriends) {
      loadFriends();
    }
  }, [query, friends.length, loadingFriends, loadFriends]);

  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 2) return;
    let cancelled = false;
    api
      .searchUsersServer(debouncedQuery, { limit: 20 })
      .then((page) => {
        if (!cancelled) setResults(page.items);
      })
      .catch((e) => {
        if (!cancelled) {
          setResults([]);
          toastError("No se pudo buscar usuarios", e);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const displayedItems = query
    ? resolvedResults
    : showList
      ? friends
      : [];
  const listTitle = query ? "Resultados" : "Tus amigos";

  const toggleSelected = useCallback((user: User) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[user.id]) delete next[user.id];
      else next[user.id] = user;
      return next;
    });
    setConfirming(false);
  }, []);

  const removeSelected = useCallback(
    (id: string) => {
      setSelected((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setConfirming(false);
    },
    [],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      setError("Selecciona al menos un destinatario");
      return;
    }
    if (invalidAmount) {
      setError("Ingrese una cantidad válida");
      return;
    }
    if (insufficient) {
      setError("Saldo insuficiente en la bóveda");
      return;
    }
    if (!description.trim()) {
      setError("La descripción es obligatoria");
      return;
    }
    if (description.length > 500) {
      setError("La descripción no puede exceder 500 caracteres");
      return;
    }
    if (!confirming) {
      setError(null);
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    const totalToDeduct = parsed * selectedIds.length;
    const revert = applyOptimisticBalance(-totalToDeduct);
    try {
      const desc = description.trim();
      for (const id of selectedIds) {
        await api.transfer(id, parsed, desc);
      }
      setAmount("");
      setSelected({});
      setQuery("");
      setResults([]);
      setFriends([]);
      setShowList(false);
      setConfirming(false);
      toastSuccess(
        "Transferencias realizadas",
        `${selectedIds.length} envíos completados (${parsed.toLocaleString()} Zerines c/u)`,
      );
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
      <div className="space-y-3">
        <SearchBar
          placeholder="Buscar usuario por nombre o email..."
          value={query}
          onChange={(v) => {
            setQuery(v);
            setShowList(true);
          }}
          onFocus={handleFocus}
          size="md"
        />
        {showList && (
          <p className="text-label-sm text-on-surface-variant px-1">
            {listTitle}
            {loadingFriends && " — cargando..."}
          </p>
        )}
        {showList && displayedItems.length === 0 && !loadingFriends && (
          <p className="text-center text-label-sm text-on-surface-variant py-6">
            {query
              ? "Sin resultados para esta búsqueda"
              : "Aún no tienes amigos. Agrégalos desde su perfil."}
          </p>
        )}
        {showList && displayedItems.length > 0 && (
          <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            {displayedItems.map((u) => {
              const isSelected = !!selected[u.id];
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => toggleSelected(u)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl transition-colors text-left ${
                    isSelected
                      ? "bg-primary-container/40 border border-primary/30"
                      : "hover:bg-surface-container-high"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full border-2 inline-flex items-center justify-center shrink-0 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-on-primary"
                        : "border-outline-variant"
                    }`}
                  >
                    {isSelected && (
                      <MaterialIcon name="check" className="text-xs" filled />
                    )}
                  </div>
                  <div className="w-10 h-10 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-display text-title-md shrink-0">
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
              );
            })}
          </div>
        )}
      </div>

      {hasAnySelected && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-label-sm text-on-surface-variant mr-1">
            {selectedIds.length}{" "}
            {selectedIds.length === 1 ? "destinatario" : "destinatarios"}:
          </span>
          {Object.values(selected).map((u) => (
            <span
              key={u.id}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary-container text-on-primary-container text-label-sm"
            >
              {u.name}
              <button
                type="button"
                onClick={() => removeSelected(u.id)}
                className="w-5 h-5 inline-flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors"
                aria-label={`Quitar ${u.name}`}
              >
                <MaterialIcon name="close" className="text-xs" filled />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-3">
            <MaterialIcon
              name="diamond"
              className="text-4xl text-secondary"
              filled
            />
            <NumberStepper
              value={parsed}
              onChange={(v) => {
                setAmount(String(v));
                setError(null);
                setConfirming(false);
              }}
              min={1}
              max={balance}
              size="lg"
            />
          </div>
          <p className="text-label-sm text-on-surface-variant mt-1 uppercase tracking-wider">
            Zerines por destinatario
          </p>
          {hasAnySelected && (
            <p className="text-label-sm text-on-surface-variant">
              Total:{" "}
              <span className="font-bold text-on-surface">
                {(parsed * selectedIds.length).toLocaleString()}
              </span>{" "}
              Zerines
            </p>
          )}
        </div>
      </div>

      {insufficient && parsed > 0 && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Saldo insuficiente. Tu balance es de{" "}
            {balance.toLocaleString()} Zerines.
          </span>
        </div>
      )}

      {invalidAmount && amount !== "" && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Ingresa una cantidad válida mayor a 0.
          </span>
        </div>
      )}

      <div>
        <input
          type="text"
          maxLength={500}
          placeholder="Descripción"
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
            setError(null);
          }}
          className="w-full px-6 py-3 rounded-full bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
          inputMode="text"
          autoComplete="off"
          enterKeyHint="done"
        />
        <div className="flex justify-end mt-1">
          <span className="text-label-sm text-on-surface-variant">
            {description.length}/500
          </span>
        </div>
      </div>

      {error && <p className="text-error text-body-md text-center">{error}</p>}

      <div className="text-center">
        {confirming ? (
          <div className="inline-flex flex-col items-center gap-3">
            <p className="text-body-md text-on-surface-variant">
              ¿Confirmar transferencia de{" "}
              <span className="font-bold text-on-surface">
                {parsed.toLocaleString()}
              </span>{" "}
              Zerines a{" "}
              <span className="font-bold text-on-surface">
                {selectedIds.length}{" "}
                {selectedIds.length === 1 ? "destinatario" : "destinatarios"}
              </span>{" "}
              con la descripción &quot;{description.trim()}&quot;?
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="crystal"
                size="lg"
                icon="send"
                disabled={submitting}
              >
                {submitting ? "Enviando..." : "Sí"}
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
            disabled={
              submitting ||
              invalidAmount ||
              !hasAnySelected ||
              insufficient ||
              !description.trim()
            }
          >
            {submitting
              ? "Enviando..."
              : `Transferir Zerines${
                  selectedIds.length > 1 ? ` (×${selectedIds.length})` : ""
                }`}
          </Button>
        )}
      </div>
    </form>
  );
}

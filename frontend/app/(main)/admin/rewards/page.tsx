"use client";

import { useEffect, useState } from "react";
import { api, PackType, Reward, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { useDebounce } from "@/hooks/useDebounce";
import { FormField, InputField, TextareaField } from "@/components/ui/AdminCrudModal";
import Button from "@/components/ui/Button";
import GlassCard from "@/components/ui/GlassCard";
import Avatar from "@/components/ui/Avatar";
import ZerineDisplay from "@/components/ui/ZerineDisplay";
import { MaterialIcon } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

export default function AdminRewardsPage() {
  const { user } = useAuthStore();
  const [packTypes, setPackTypes] = useState<PackType[]>([]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [packTypeId, setPackTypeId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [message, setMessage] = useState("");
  const [granting, setGranting] = useState(false);
  const [history, setHistory] = useState<Reward[]>([]);
  const [historySkip, setHistorySkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    api
      .getStore()
      .then((s) => setPackTypes(s.pack_types))
      .catch((e) => toastError("No se pudieron cargar los sobres", e));
  }, []);

  useEffect(() => {
    if (!debouncedSearch.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await api.searchUsersServer(debouncedSearch.trim(), { limit: 6 });
        if (!cancelled) setResults(page.items);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudieron buscar usuarios", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const visibleResults = debouncedSearch.trim() ? results : [];

  const loadHistory = async (skip = 0) => {
    try {
      const page = await api.listRewards(skip, 15);
      setHistory((prev) => (skip === 0 ? page.items : [...prev, ...page.items]));
      setHistorySkip(skip + 15);
      setHasMore(page.has_more);
    } catch (e) {
      toastError("No se pudo cargar el historial", e);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const page = await api.listRewards(0, 15);
        if (cancelled) return;
        setHistory(page.items);
        setHistorySkip(15);
        setHasMore(page.has_more);
      } catch (e) {
        if (cancelled) return;
        toastError("No se pudo cargar el historial", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (user?.role !== "admin") return null;

  const valid = selected.length > 0 && !!packTypeId && parseInt(quantity) >= 1 && parseInt(quantity) <= 100;

  const grant = async () => {
    if (!valid) return;
    setGranting(true);
    try {
      await api.grantRewards({
        user_ids: selected.map((u) => u.id),
        pack_type_id: packTypeId,
        quantity: parseInt(quantity),
        message: message.trim() || undefined,
      });
      toastSuccess("¡Sobres otorgados!", "Los búhos ya van en camino 🦉");
      setSelected([]);
      setSearch("");
      setMessage("");
      setHistory([]);
      loadHistory(0);
    } catch (e) {
      toastError("No se pudieron otorgar los sobres", e);
    } finally {
      setGranting(false);
    }
  };

  const packType = packTypes.find((p) => p.id === packTypeId);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 pb-24">
      <div>
        <h1 className="font-display text-2xl text-primary">Recompensas de Admin</h1>
        <p className="text-xs text-outline">
          Otorga sobres a jugadores. Los Zerines y las figuritas directas no se pueden regalar.
        </p>
      </div>

      <GlassCard className="space-y-4 p-5">
        <FormField label="Buscar jugadores" helpText="Aparecen al escribir 2+ caracteres.">
          <InputField
            value={search}
            onChange={setSearch}
            placeholder="Nombre del jugador…"
            firstInput
          />
        </FormField>

        {visibleResults.length > 0 && (
          <ul className="space-y-1.5">
            {visibleResults
              .filter((r) => !selected.some((s) => s.id === r.id))
              .map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => {
                      setSelected((s) => [...s, r]);
                      setSearch("");
                      setResults([]);
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-container-high active:scale-[0.98]"
                  >
                    <Avatar src={r.avatar_url} initials={r.name.slice(0, 2).toUpperCase()} size="sm" />
                    <span className="flex-1 text-sm font-medium text-primary">{r.name}</span>
                    <MaterialIcon name="add_circle" className="text-secondary" />
                  </button>
                </li>
              ))}
          </ul>
        )}

        {selected.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-widest text-outline">
              Destinatarios ({selected.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {selected.map((u) => (
                <span
                  key={u.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-1 pr-2 text-xs font-medium text-primary"
                >
                  <Avatar src={u.avatar_url} initials={u.name.slice(0, 2).toUpperCase()} size="xs" />
                  {u.name}
                  <button
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== u.id))}
                    aria-label={`Quitar a ${u.name}`}
                    className="rounded-full p-0.5 hover:bg-primary/20"
                  >
                    <MaterialIcon name="close" className="text-sm" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <FormField label="Tipo de sobre" required>
            <select
              value={packTypeId}
              onChange={(e) => setPackTypeId(e.target.value)}
              className="w-full rounded-xl border border-outline-variant/20 bg-surface-container-low px-4 py-3 text-body-md"
            >
              <option value="">Seleccionar…</option>
              {packTypes.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.name} — <ZerineDisplay amount={p.price_zerines} variant="price" /> ({p.enabled ? "activo" : "desactivado"})
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Cantidad (1-100)" required>
            <InputField
              type="number"
              value={quantity}
              onChange={setQuantity}
              placeholder="1"
            />
          </FormField>
        </div>

        <FormField label="Mensaje del búho (opcional)">
          <TextareaField
            value={message}
            onChange={setMessage}
            placeholder="Ej: ¡Buen partido ayer! Te va a hacer falta esto…"
            rows={2}
          />
        </FormField>

        <Button
          className="w-full sm:w-auto"
          disabled={!valid || granting}
          onClick={grant}
          icon="redeem"
        >
          {valid
            ? `Otorgar ${quantity} × ${packType?.name ?? "sobre"} a ${selected.length} jugador${selected.length === 1 ? "" : "es"}`
            : "Completa la selección"}
        </Button>
      </GlassCard>

      <section>
        <h2 className="mb-3 font-display text-lg text-primary">Historial de recompensas</h2>
        {history.length === 0 ? (
          <p className="text-sm text-outline">Todavía no hay recompensas otorgadas.</p>
        ) : (
          <>
            <ul className="space-y-2">
              {history.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl bg-surface-container-low px-4 py-3">
                  <Avatar src={undefined} initials={r.user_name.slice(0, 2).toUpperCase()} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-primary">
                      {r.user_name} ← {r.admin_name}
                    </p>
                    <p className="truncate text-[11px] text-outline">
                      {r.quantity} × {r.pack_type_name}
                      {r.message ? ` · "${r.message}"` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[10px] text-outline">
                    {new Date(r.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
            {hasMore && (
              <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => loadHistory(historySkip)}>
                Ver más
              </Button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
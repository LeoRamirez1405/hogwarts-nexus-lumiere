"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { api, Transaction, User } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import GlassCard from "@/components/ui/GlassCard";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import TabGroup from "@/components/ui/TabGroup";
import SearchBar from "@/components/ui/SearchBar";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

function formatAmount(amount: number) {
  return amount.toLocaleString();
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusColor(status: Transaction["status"]) {
  switch (status) {
    case "completed":
      return "success";
    case "confirmed":
      return "primary";
    case "pending":
      return "secondary";
    default:
      return "default";
  }
}

function txIcon(type: Transaction["type"]) {
  switch (type) {
    case "deposit":
      return { icon: "arrow_downward", color: "bg-success/10 text-success" };
    case "withdrawal":
      return { icon: "arrow_upward", color: "bg-error/10 text-error" };
    case "transfer":
      return { icon: "swap_horiz", color: "bg-primary/10 text-primary" };
    default:
      return { icon: "receipt_long", color: "bg-surface-container-high text-on-surface-variant" };
  }
}

const tabs = [
  { id: "deposit", label: "Plantillas de Deposito", icon: "add_circle" },
  { id: "withdraw", label: "Retirar", icon: "remove_circle" },
  { id: "transfer", label: "Transferencias", icon: "swap_horiz" },
  { id: "history", label: "Recibos y Facturacion", icon: "history" },
];

/* ──────────────────────── DEPOSIT TAB ──────────────────────── */

function DepositTab({ onDone }: { onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) {
      setError("Ingrese una cantidad valida");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.deposit(parsed, description || undefined);
      setAmount("");
      setDescription("");
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <div className="font-display text-5xl text-on-surface flex items-center justify-center gap-3">
          <span className="text-4xl">💎</span>
          <input
            type="number"
            min="1"
            step="any"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="w-48 bg-transparent outline-none text-center font-display text-5xl text-on-surface placeholder:text-outline-variant/40 border-b-2 border-outline-variant/30 focus:border-primary transition-colors"
          />
        </div>
        <p className="text-label-sm text-on-surface-variant mt-3 uppercase tracking-wider">
          Zerines a depositar
        </p>
      </div>

      <div>
        <input
          type="text"
          placeholder="Descripcion (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-6 py-3 rounded-full bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && (
        <p className="text-error text-body-md text-center">{error}</p>
      )}

      <div className="text-center">
        <Button
          type="submit"
          variant="crystal"
          size="lg"
          icon="diamond"
          disabled={submitting || !amount}
        >
          {submitting ? "Depositando..." : "Depositar Zerines"}
        </Button>
      </div>
    </form>
  );
}

/* ──────────────────────── WITHDRAW TAB ──────────────────────── */

function WithdrawTab({
  balance,
  onDone,
}: {
  balance: number;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseFloat(amount) || 0;
  const insufficient = parsed > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parsed || parsed <= 0) {
      setError("Ingrese una cantidad valida");
      return;
    }
    if (insufficient) {
      setError("Saldo insuficiente en la boveda");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.withdraw(parsed, description || undefined);
      setAmount("");
      setDescription("");
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <div className="font-display text-5xl text-on-surface flex items-center justify-center gap-3">
          <span className="text-4xl">💎</span>
          <input
            type="number"
            min="1"
            step="any"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            className="w-48 bg-transparent outline-none text-center font-display text-5xl text-on-surface placeholder:text-outline-variant/40 border-b-2 border-outline-variant/30 focus:border-primary transition-colors"
          />
        </div>
        <p className="text-label-sm text-on-surface-variant mt-3 uppercase tracking-wider">
          Zerines a retirar
        </p>
      </div>

      {insufficient && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Saldo insuficiente. Tu balance es de {formatAmount(balance)} Zerines.
          </span>
        </div>
      )}

      <div>
        <input
          type="text"
          placeholder="Descripcion (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-6 py-3 rounded-full bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && (
        <p className="text-error text-body-md text-center">{error}</p>
      )}

      <div className="text-center">
        <Button
          type="submit"
          variant="danger"
          size="lg"
          icon="diamond"
          disabled={submitting || !amount || insufficient}
        >
          {submitting ? "Retirando..." : "Retirar Zerines"}
        </Button>
      </div>
    </form>
  );
}

/* ──────────────────────── TRANSFER TAB ──────────────────────── */

function TransferTab({
  balance,
  onDone,
}: {
  balance: number;
  onDone: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User | null>(null);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const queryRef = useRef("");

  const parsed = parseFloat(amount) || 0;
  const insufficient = parsed > balance;

  useEffect(() => {
    queryRef.current = query;
  }, [query]);

  useEffect(() => {
    if (!query || query.length < 2) return;
    const timer = setTimeout(() => {
      setSearching(true);
      api
        .getUsers()
        .then((users) => {
          if (queryRef.current !== query) return;
          const q = query.toLowerCase();
          setResults(
            users.filter(
              (u) =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q)
            )
          );
        })
        .catch(() => {
          if (queryRef.current === query) setResults([]);
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
    if (!parsed || parsed <= 0) {
      setError("Ingrese una cantidad valida");
      return;
    }
    if (insufficient) {
      setError("Saldo insuficiente en la boveda");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.transfer(selected.id, parsed, description || undefined);
      setAmount("");
      setDescription("");
      setQuery("");
      setSelected(null);
      setResults([]);
      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error desconocido");
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
            onChange={setQuery}
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
          <span className="text-4xl">💎</span>
          <input
            type="number"
            min="1"
            step="any"
            placeholder="0"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
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
            Saldo insuficiente. Tu balance es de {formatAmount(balance)} Zerines.
          </span>
        </div>
      )}

      <div>
        <input
          type="text"
          placeholder="Descripcion (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-6 py-3 rounded-full bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:border-primary transition-colors"
        />
      </div>

      {error && (
        <p className="text-error text-body-md text-center">{error}</p>
      )}

      <div className="text-center">
        <Button
          type="submit"
          variant="crystal"
          size="lg"
          icon="send"
          disabled={submitting || !amount || !selected || insufficient}
        >
          {submitting ? "Enviando..." : "Transferir Zerines"}
        </Button>
      </div>
    </form>
  );
}

/* ──────────────────────── HISTORY TAB ──────────────────────── */

function HistoryTab({ transactions }: { transactions: Transaction[] }) {
  if (transactions.length === 0) {
    return (
      <div className="text-center py-12">
        <MaterialIcon
          name="receipt_long"
          className="text-6xl text-outline-variant/40 mb-4 block mx-auto"
        />
        <p className="text-on-surface-variant text-body-md">
          No hay transacciones en tu historial
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const { icon, color } = txIcon(tx.type);
        const isCredit = tx.type === "deposit" || tx.receiver_id;
        return (
          <div
            key={tx.id}
            className="flex items-center gap-4 p-4 rounded-xl bg-surface-container-low/50 hover:bg-surface-container-high transition-colors"
          >
            <div
              className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 ${color}`}
            >
              <MaterialIcon name={icon} className="text-xl" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md text-on-surface truncate">
                {tx.description || tx.type}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-label-sm text-on-surface-variant">
                  {formatTime(tx.created_at)}
                </p>
                <Badge variant="tag" color={statusColor(tx.status)}>
                  {tx.status}
                </Badge>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p
                className={`font-display text-title-md ${
                  isCredit ? "text-success" : "text-error"
                }`}
              >
                {isCredit ? "+" : "-"}
                {formatAmount(tx.amount)}
              </p>
              <p className="text-label-sm text-on-surface-variant flex items-center justify-end gap-1">
                <span className="text-[0.7em]">💎</span> Zerines
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────── PAGE ──────────────────────── */

export default function TreasuryPage() {
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState("deposit");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [balance, setBalance] = useState(user?.zerines ?? 0);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([api.getTransactions(), api.getMe()])
      .then(([txs, me]) => {
        if (!mountedRef.current) return;
        setTransactions(txs);
        setBalance(me.zerines);
        setUser(me);
      })
      .catch(() => {})
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
  }, [setUser]);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    (async () => {
      try {
        const [txs, me] = await Promise.all([api.getTransactions(), api.getMe()]);
        if (!cancelled) {
          setTransactions(txs);
          setBalance(me.zerines);
          setUser(me);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [setUser]);

  const displayBalance = useMemo(
    () => user?.zerines ?? balance,
    [user?.zerines, balance]
  );

  return (
    <div className="space-y-8">
      {/* Crystal Hero */}
      <div className="crystal-gradient rounded-2xl overflow-hidden relative">
        <div className="absolute inset-0 inner-sparkle" />
        <div className="relative z-10 p-10 md:p-16 text-center text-on-primary">
          <div className="mb-3">
            <span className="text-label-sm uppercase tracking-[0.2em] opacity-70">
              Camara del Tesoro
            </span>
          </div>
          <div className="font-display text-6xl md:text-7xl flex items-center justify-center gap-4 mb-4">
            <span className="text-5xl md:text-6xl">💎</span>
            <span>{loading ? "---" : formatAmount(displayBalance)}</span>
          </div>
          <p className="text-label-sm uppercase tracking-wider opacity-70">
            Zerines Disponibles
          </p>
          <div className="mt-6 inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-full px-4 py-2">
            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
              shield
            </span>
            <span className="text-label-sm text-on-primary/80">Transacciones seguras y encriptadas</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <TabGroup tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <GlassCard>
        <div className="p-6 md:p-8">
          {activeTab === "deposit" && <DepositTab onDone={refresh} />}
          {activeTab === "withdraw" && (
            <WithdrawTab balance={displayBalance} onDone={refresh} />
          )}
          {activeTab === "transfer" && <TransferTab balance={displayBalance} onDone={refresh} />}
          {activeTab === "history" && (
            <HistoryTab transactions={transactions} />
          )}
        </div>
      </GlassCard>
    </div>
  );
}

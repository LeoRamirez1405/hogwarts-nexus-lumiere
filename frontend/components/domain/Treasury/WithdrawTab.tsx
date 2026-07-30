"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, MaterialIcon } from "@/components/ui";

interface WithdrawTabProps {
  balance: number;
  onDone: () => void;
}

export function WithdrawTab({ balance, onDone }: WithdrawTabProps) {
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
    setSubmitting(true);
    setError(null);
    try {
      await api.withdraw(parsed, description.trim());
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
            Saldo insuficiente. Tu balance es de {balance.toLocaleString()} Zerines.
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
        <Button
          type="submit"
          variant="danger"
          size="lg"
          icon="diamond"
          disabled={submitting || !amount || insufficient || !description.trim()}
        >
          {submitting ? "Retirando..." : "Retirar Zerines"}
        </Button>
      </div>
    </form>
  );
}
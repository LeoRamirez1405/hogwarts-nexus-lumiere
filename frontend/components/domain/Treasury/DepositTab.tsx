"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, MaterialIcon } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface DepositTabProps {
  onDone: () => void | Promise<void>;
  applyOptimisticBalance: (delta: number) => () => void;
  onErrorRollback: () => void | Promise<void>;
}

export function DepositTab({ onDone, applyOptimisticBalance, onErrorRollback }: DepositTabProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseInt(amount, 10) || 0;
  const invalidAmount = !amount || parsed <= 0 || !Number.isInteger(parsed);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(amount, 10);
    if (!parsed || parsed <= 0 || !Number.isInteger(parsed)) {
      setError("Ingrese una cantidad valida");
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
    const revert = applyOptimisticBalance(parsed);
    try {
      await api.deposit(parsed, description.trim());
      setAmount("");
      setDescription("");
      toastSuccess("Depósito realizado", `${parsed.toLocaleString()} Zerines añadidos a tu bóveda`);
      await onDone();
    } catch (err: unknown) {
      revert();
      await onErrorRollback();
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      toastError("No se pudo completar el depósito", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {invalidAmount && amount !== "" && !error && (
        <div className="flex items-center gap-3 bg-error/10 rounded-xl px-6 py-3">
          <MaterialIcon name="warning" className="text-error text-xl" />
          <span className="text-error text-body-md">
            Ingresa una cantidad valida mayor a 0.
          </span>
        </div>
      )}

      <div className="text-center">
        <Button
          type="submit"
          variant="crystal"
          size="lg"
          icon="diamond"
          disabled={submitting || invalidAmount || !description.trim()}
        >
          {submitting ? "Depositando..." : "Depositar Zerines"}
        </Button>
      </div>
    </form>
  );
}
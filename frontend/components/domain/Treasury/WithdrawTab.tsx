"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { Button, MaterialIcon, NumberStepper } from "@/components/ui";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface WithdrawTabProps {
  balance: number;
  onDone: () => void | Promise<void>;
  applyOptimisticBalance: (delta: number) => () => void;
  onErrorRollback: () => void | Promise<void>;
}

export function WithdrawTab({ balance, onDone, applyOptimisticBalance, onErrorRollback }: WithdrawTabProps) {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = parseInt(amount, 10) || 0;
  const invalidAmount = !amount || parsed <= 0 || !Number.isInteger(parsed);
  const insufficient = parsed > balance;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      await api.withdraw(parsed, description.trim());
      setAmount("");
      setDescription("");
      setConfirming(false);
      toastSuccess("Retiro realizado", `${parsed.toLocaleString()} Zerines retirados de tu bóveda`);
      await onDone();
    } catch (err: unknown) {
      revert();
      await onErrorRollback();
      setConfirming(false);
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(msg);
      toastError("No se pudo completar el retiro", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center gap-3">
            <MaterialIcon name="diamond" className="text-4xl text-secondary" filled />
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
            Zerines a retirar
          </p>
        </div>
      </div>

      {insufficient && (
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
          autoComplete="off"
          enterKeyHint="done"
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
              ¿Confirmar retiro de <span className="font-bold text-on-surface">{parsed.toLocaleString()}</span> Zerines de tu bóveda?
            </p>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="danger"
                size="lg"
                icon="diamond"
                disabled={submitting}
              >
                {submitting ? "Retirando..." : "Sí, confirmar"}
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
            variant="danger"
            size="lg"
            icon="diamond"
            disabled={submitting || invalidAmount || insufficient || !description.trim()}
          >
            {submitting ? "Retirando..." : "Retirar Zerines"}
          </Button>
        )}
      </div>
    </form>
  );
}
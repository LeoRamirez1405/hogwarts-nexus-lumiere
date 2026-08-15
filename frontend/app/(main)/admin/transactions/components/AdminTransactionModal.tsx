"use client";

import { useEffect, useState } from "react";
import { api, User } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import Avatar from "@/components/ui/Avatar";
import { MaterialIcon } from "@/components/ui";
import {
  AdminCrudModal,
  FormField,
  InputField,
  TextareaField,
  ToggleButtonGroup,
} from "@/components/ui/AdminCrudModal";
import { toastError, toastSuccess } from "@/lib/toastStore";

interface AdminTransactionModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

type Operation = "deposit" | "withdrawal";

export default function AdminTransactionModal({
  open,
  onClose,
  onCreated,
}: AdminTransactionModalProps) {
  const [operation, setOperation] = useState<Operation>("deposit");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [results, setResults] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (prevOpen !== open) {
    setPrevOpen(open);
    if (open) {
      setOperation("deposit");
      setSearch("");
      setResults([]);
      setSelected([]);
      setAmount("");
      setDescription("");
      setSaving(false);
    }
  }

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

  const amountInt = parseInt(amount, 10);
  const amountValid = Number.isInteger(amountInt) && amountInt >= 1;
  const descriptionValid = description.trim().length > 0;
  const insufficient = selected.filter((u) => u.zerines < amountInt);
  const valid =
    selected.length > 0 &&
    amountValid &&
    descriptionValid &&
    (operation === "deposit" || insufficient.length === 0);

  const visibleResults = debouncedSearch.trim() ? results.filter((r) => !selected.some((s) => s.id === r.id)) : [];

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const ids = selected.map((u) => u.id);
      const desc = description.trim();
      if (operation === "deposit") {
        await api.adminDeposit(ids, amountInt, desc);
      } else {
        await api.adminWithdraw(ids, amountInt, desc);
      }
      toastSuccess(
        operation === "deposit" ? "Depósito realizado" : "Retiro realizado",
        `${amountInt} zerines a ${selected.length} usuario${selected.length === 1 ? "" : "s"}`
      );
      onCreated();
      onClose();
    } catch (e) {
      toastError(
        operation === "deposit" ? "No se pudo depositar" : "No se pudo retirar",
        e
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminCrudModal
      open={open}
      onClose={onClose}
      title={operation === "deposit" ? "Nuevo depósito" : "Nuevo retiro"}
      saveLabel={operation === "deposit" ? "Depositar" : "Retirar"}
      saving={saving}
      saveDisabled={!valid}
      onSave={handleSave}
    >
      <FormField label="Operación" required>
        <ToggleButtonGroup<Operation>
          value={operation}
          onChange={setOperation}
          options={[
            { value: "deposit", label: "Depósito" },
            { value: "withdrawal", label: "Retiro" },
          ]}
        />
      </FormField>

      <FormField
        label="Buscar usuarios"
        required
        helpText="Aparecen al escribir 2+ caracteres. Puedes elegir varios."
      >
        <InputField
          value={search}
          onChange={setSearch}
          placeholder="Nombre del jugador…"
          firstInput
        />
      </FormField>

      {visibleResults.length > 0 && (
        <ul className="space-y-1.5">
          {visibleResults.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected((s) => [...s, r]);
                  setSearch("");
                  setResults([]);
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-surface-container-high active:scale-[0.98]"
              >
                <Avatar src={r.avatar_url} initials={r.name.slice(0, 2).toUpperCase()} size="sm" />
                <span className="flex-1 truncate text-body-md font-medium text-on-surface">
                  {r.name}
                </span>
                <span className="flex items-center gap-1 text-label-sm text-on-surface-variant">
                  <MaterialIcon name="diamond" className="text-secondary text-sm" />
                  {r.zerines.toLocaleString()}
                </span>
                <MaterialIcon name="add_circle" className="text-secondary" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected.length > 0 && (
        <div>
          <p className="mb-2 text-label-sm uppercase tracking-widest text-on-surface-variant">
            Destinatarios ({selected.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selected.map((u) => {
              const low = operation === "withdrawal" && u.zerines < amountInt;
              return (
                <span
                  key={u.id}
                  className={`inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2 text-label-sm font-medium ${
                    low
                      ? "bg-error/10 text-error"
                      : "bg-primary/10 text-primary"
                  }`}
                >
                  <Avatar src={u.avatar_url} initials={u.name.slice(0, 2).toUpperCase()} size="xs" />
                  {u.name}
                  <span className="inline-flex items-center gap-0.5">
                    <MaterialIcon name="diamond" className="text-xs" />
                    {u.zerines.toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelected((s) => s.filter((x) => x.id !== u.id))}
                    aria-label={`Quitar a ${u.name}`}
                    className="rounded-full p-0.5 hover:bg-white/20"
                  >
                    <MaterialIcon name="close" className="text-sm" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <FormField
        label="Monto"
        required
        helpText="Zerines a aplicar a cada usuario seleccionado."
        error={
          amount && !amountValid
            ? "El monto debe ser un número entero mayor a 0."
            : undefined
        }
      >
        <InputField
          type="number"
          value={amount}
          onChange={setAmount}
          placeholder="0"
          min={1}
          inputMode="numeric"
        />
      </FormField>

      {operation === "withdrawal" && insufficient.length > 0 && amountValid && (
        <div className="flex items-start gap-2 rounded-xl bg-error/10 px-4 py-3 text-label-sm text-error">
          <MaterialIcon name="warning" className="mt-0.5" />
          <span>
            Saldo insuficiente: {insufficient.map((u) => u.name).join(", ")} no tiene
            suficientes zerines para el retiro.
          </span>
        </div>
      )}

      <FormField
        label="Descripción"
        required
        helpText="Este motivo también se incluye en la notificación al usuario."
        error={description && !descriptionValid ? "La descripción es obligatoria." : undefined}
      >
        <TextareaField
          value={description}
          onChange={setDescription}
          placeholder="Motivo de la transacción…"
          rows={2}
          maxLength={500}
        />
      </FormField>
    </AdminCrudModal>
  );
}
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { MaterialIcon } from "@/components/ui/MaterialIcon";
import { createPortal } from "react-dom";

interface DateTimePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (dateTime: string) => void; // ISO string
  initialDateTime?: string;
  title?: string;
}

export default function DateTimePickerModal({
  isOpen,
  onClose,
  onConfirm,
  initialDateTime,
  title = "Programar mensaje",
}: DateTimePickerModalProps) {
  const [date, setDate] = useState(() => {
    const base = initialDateTime ? new Date(initialDateTime) : new Date();
    base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5);
    base.setSeconds(0);
    base.setMilliseconds(0);
    return base.toISOString().split("T")[0];
  });
  const [time, setTime] = useState(() => {
    const base = initialDateTime ? new Date(initialDateTime) : new Date();
    base.setMinutes(Math.ceil(base.getMinutes() / 5) * 5);
    base.setSeconds(0);
    base.setMilliseconds(0);
    return base.toTimeString().slice(0, 5);
  });
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Focus date input after render
      setTimeout(() => inputRef.current?.focus(), 100);

      // Trap focus
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") onClose();
        if (e.key === "Tab") {
          const focusable = modalRef.current?.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (!focusable || focusable.length === 0) return;
          const first = focusable[0] as HTMLElement;
          const last = focusable[focusable.length - 1] as HTMLElement;
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }
  }, [isOpen, onClose]);

  const validateAndConfirm = useCallback(() => {
    if (!date || !time) {
      setError("Selecciona una fecha y una hora");
      return;
    }

    const selected = new Date(`${date}T${time}:00`);
    const now = new Date();
    now.setSeconds(0);
    now.setMilliseconds(0);

    if (selected <= now) {
      setError("La fecha y hora deben ser en el futuro");
      return;
    }

    // Optional: warn if too far in future (e.g., > 1 year)
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    if (selected > oneYear) {
      setError("No puedes programar con más de 1 año de antelación");
      return;
    }

    setError(null);
    onConfirm(selected.toISOString());
  }, [date, time, onConfirm]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="datetime-modal-title"
    >
      <div
        ref={modalRef}
        className="bg-surface-container w-full max-w-sm rounded-2xl border border-outline-variant/20 shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-outline-variant/20">
          <h2 id="datetime-modal-title" className="font-display text-headline-sm text-on-surface">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-on-surface-variant hover:bg-surface-container-high transition-colors"
            aria-label="Cerrar"
          >
            <MaterialIcon name="close" className="text-xl" />
          </button>
        </div>

        {/* Date & Time Inputs */}
        <div className="p-4 space-y-4">
          <div>
            <label htmlFor="schedule-date" className="block text-label-md text-on-surface-variant mb-1.5">
              Fecha
            </label>
            <input
              ref={inputRef}
              id="schedule-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/30 text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label htmlFor="schedule-time" className="block text-label-md text-on-surface-variant mb-1.5">
              Hora
            </label>
            <input
              id="schedule-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={300} // 5 minutes
              className="w-full px-3 py-2.5 rounded-xl bg-surface border border-outline-variant/30 text-body-md text-on-surface outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-error/10 border border-error/30 text-error text-label-sm" role="alert">
              {error}
            </div>
          )}

          {/* Quick select buttons */}
          <div className="pt-2">
            <p className="text-label-sm text-on-surface-variant mb-2">O accesos rápidos:</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "15 min", minutes: 15 },
                { label: "30 min", minutes: 30 },
                { label: "1 hora", minutes: 60 },
                { label: "3 horas", minutes: 180 },
                { label: "Mañana 9:00", special: "tomorrow9" },
                { label: "En 1 día", minutes: 1440 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    if ("special" in opt && opt.special === "tomorrow9") {
                      const tomorrow = new Date(now);
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      tomorrow.setHours(9, 0, 0, 0);
                      setDate(tomorrow.toISOString().split("T")[0]);
                      setTime(tomorrow.toTimeString().slice(0, 5));
                    } else {
                      const future = new Date(now.getTime() + (opt.minutes as number) * 60000);
                      future.setMinutes(Math.ceil(future.getMinutes() / 5) * 5);
                      future.setSeconds(0);
                      future.setMilliseconds(0);
                      setDate(future.toISOString().split("T")[0]);
                      setTime(future.toTimeString().slice(0, 5));
                    }
                    setError(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/30 text-label-md text-on-surface hover:bg-surface-container transition-colors"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-outline-variant/20 bg-surface-container-low/50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-label-md font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={validateAndConfirm}
            className="px-4 py-2 rounded-xl text-label-md font-medium bg-primary text-on-primary hover:opacity-90 transition-opacity"
          >
            Programar
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;

  return createPortal(modalContent, document.body);
}
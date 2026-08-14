"use client";

import Modal from "@/components/ui/Modal";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import { useEffect, useRef } from "react";
import { useIsDesktopMdUp } from "@/hooks/useMediaQuery";

export interface AdminCrudModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  onSave: () => Promise<void> | void;
}

export function AdminCrudModal({
  open,
  onClose,
  title,
  children,
  size = "md",
  saving = false,
  saveLabel = "Guardar",
  cancelLabel = "Cancelar",
  saveDisabled = false,
  onSave,
}: AdminCrudModalProps) {
  const isDesktop = useIsDesktopMdUp(false);
  const firstInputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (open && firstInputRef.current) {
      firstInputRef.current.focus();
    }
  }, [open]);

  if (!open) return null;

  const body = (
    <div className={isDesktop ? "p-6 space-y-5 max-h-[80vh] overflow-y-auto no-scrollbar" : "space-y-5 pb-2"}>
      {isDesktop && (
        <h2 className="font-display text-headline-lg text-on-surface">{title}</h2>
      )}
      <div className="space-y-4">{children}</div>
      <div className="flex gap-3 pt-4">
        <Button
          variant="secondary"
          onClick={onClose}
          className="flex-1 !py-2 !text-label-sm sm:!py-3 sm:!text-body-md"
          disabled={saving}
        >
          {cancelLabel}
        </Button>
        <Button
          variant="primary"
          onClick={onSave}
          disabled={saving || saveDisabled}
          className="flex-1 !py-2 !text-label-sm sm:!py-3 sm:!text-body-md"
        >
          {saving ? "Guardando..." : saveLabel}
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    return <Modal open={open} onClose={onClose} size={size}>{body}</Modal>;
  }

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      {body}
    </BottomSheet>
  );
}

export interface FormFieldProps {
  label: string;
  required?: boolean;
  helpText?: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}

export function FormField({ label, required, helpText, error, className, children }: FormFieldProps) {
  return (
    <div className={className}>
      <label className="text-label-sm text-on-surface-variant uppercase tracking-wider block mb-2">
        {label}
        {required && <span className="text-error ml-1">*</span>}
      </label>
      {children}
      {helpText && <p className="text-label-sm text-on-surface-variant mt-1">{helpText}</p>}
      {error && <p className="text-label-sm text-error mt-1">{error}</p>}
    </div>
  );
}

export function InputField({
  value,
  onChange,
  type = "text",
  placeholder,
  disabled = false,
  autoFocus = false,
  className = "",
  firstInput = false,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  type?: "text" | "number" | "email" | "password";
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  firstInput?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) {
  const ref = firstInput ? (el: HTMLInputElement | null) => { if (el) el.setAttribute("data-admin-modal-first-input", ""); } : undefined;
  
  return (
    <input
      ref={ref}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      autoFocus={autoFocus}
      className={`w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors disabled:bg-surface-container-highest disabled:text-on-surface-variant ${className}`}
      {...props}
    />
  );
}

export function TextareaField({
  value,
  onChange,
  placeholder,
  rows = 3,
  className = "",
  firstInput = false,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  firstInput?: boolean;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange">) {
  const ref = firstInput ? (el: HTMLTextAreaElement | null) => { if (el) el.setAttribute("data-admin-modal-first-input", ""); } : undefined;
  
  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={`w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors min-h-[80px] resize-none ${className}`}
      {...props}
    />
  );
}

export function SelectField({
  value,
  onChange,
  options,
  placeholder = "Seleccionar...",
  className = "",
  firstInput = false,
  ...props
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  firstInput?: boolean;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange">) {
  const ref = firstInput ? (el: HTMLSelectElement | null) => { if (el) el.setAttribute("data-admin-modal-first-input", ""); } : undefined;
  
  return (
    <select
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors ${className}`}
      {...props}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export function ToggleButtonGroup<T extends string>({
  value,
  onChange,
  options,
  className = "",
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; color?: "primary" | "secondary" }[];
  className?: string;
}) {
  return (
    <div className={`flex gap-3 ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-3 rounded-xl font-medium text-body-md border transition-all ${
            value === opt.value
              ? opt.color === "secondary"
                ? "bg-secondary text-on-secondary border-secondary"
                : "bg-primary text-on-primary border-primary"
              : "bg-surface-container-low text-on-surface-variant border-outline-variant/20 hover:bg-surface-container-high"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
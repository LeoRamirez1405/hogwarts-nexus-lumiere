"use client";

import { useCallback, useRef } from "react";
import { MaterialIcon } from "@/components/ui";
import { useHapticSelection } from "@/hooks/useHapticFeedback";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
}

const sizeClasses: Record<NonNullable<NumberStepperProps["size"]>, {
  button: string;
  input: string;
  gap: string;
}> = {
  sm: {
    button: "w-11 h-11",
    input: "text-body-md w-16",
    gap: "gap-2",
  },
  md: {
    button: "w-11 h-11",
    input: "text-title-md w-24",
    gap: "gap-3",
  },
  lg: {
    button: "w-12 h-12",
    input: "text-headline-lg w-32",
    gap: "gap-4",
  },
};

export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  step = 1,
  prefix,
  suffix,
  size = "md",
  className = "",
  disabled = false,
}: NumberStepperProps) {
  const classes = sizeClasses[size];
  const inputRef = useRef<HTMLInputElement>(null);
  const hapticSelection = useHapticSelection();

  const clamp = useCallback((v: number) => {
    return Math.max(min, Math.min(max, v));
  }, [min, max]);

  const handleStep = useCallback((direction: 1 | -1) => {
    if (disabled) return;
    const newValue = clamp(value + direction * step);
    hapticSelection();
    onChange(newValue);
  }, [disabled, clamp, value, step, onChange, hapticSelection]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed));
    } else if (raw === "") {
      onChange(min);
    }
  }, [clamp, onChange, min]);

  const handleBlur = useCallback(() => {
    const parsed = parseInt(inputRef.current?.value ?? "", 10);
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  }, [clamp, onChange]);

  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && value < max;

  return (
    <div className={`inline-flex items-center ${classes.gap} ${className}`}>
      <button
        type="button"
        onClick={() => handleStep(-1)}
        disabled={!canDecrement}
        aria-label="Disminuir"
        className={`${classes.button} inline-flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        <MaterialIcon name="remove" className="text-xl" />
      </button>

      <div className="relative flex items-center justify-center">
        {prefix && (
          <span className="absolute left-0 text-on-surface-variant text-body-md">
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type="number"
          value={String(value)}
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          inputMode="numeric"
          enterKeyHint="done"
          className={`${classes.input} text-center bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 font-display text-on-surface border-b-2 border-outline-variant/30 focus:border-primary transition-colors`}
          style={{
            MozAppearance: "textfield",
          }}
        />
        {suffix && (
          <span className="absolute right-0 text-on-surface-variant text-body-md">
            {suffix}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => handleStep(1)}
        disabled={!canIncrement}
        aria-label="Aumentar"
        className={`${classes.button} inline-flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`}
      >
        <MaterialIcon name="add" className="text-xl" />
      </button>
    </div>
  );
}

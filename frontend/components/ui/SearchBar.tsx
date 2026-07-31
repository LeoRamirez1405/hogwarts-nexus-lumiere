"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { MaterialIcon } from "./MaterialIcon";

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  variant?: "light" | "dark";
  className?: string;
  ariaLabel?: string;
  debounceMs?: number;
}

const sizeClasses: Record<NonNullable<SearchBarProps["size"]>, string> = {
  sm: "px-4 py-2",
  md: "px-6 py-3",
};

const variantClasses: Record<
  NonNullable<SearchBarProps["variant"]>,
  { wrapper: string; text: string; placeholder: string; icon: string }
> = {
  light: {
    wrapper: "bg-surface-container-low border-outline-variant/20",
    text: "text-on-surface",
    placeholder: "placeholder:text-on-surface-variant/50",
    icon: "text-on-surface-variant",
  },
  dark: {
    wrapper: "bg-inverse-surface border-secondary/20",
    text: "text-inverse-on-surface",
    placeholder: "placeholder:text-inverse-on-surface/50",
    icon: "text-inverse-on-surface/60",
  },
};

export default function SearchBar({
  placeholder = "Buscar...",
  value,
  onChange,
  size = "md",
  variant = "light",
  className = "",
  ariaLabel = "Buscar",
  debounceMs,
}: SearchBarProps) {
  const styles = variantClasses[variant];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [internal, setInternal] = useState(value ?? "");

  const isControlled = value !== undefined;

  const handleChange = useCallback(
    (raw: string) => {
      if (!isControlled) setInternal(raw);
      if (onChange) {
        if (debounceMs) {
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => onChange(raw), debounceMs);
        } else {
          onChange(raw);
        }
      }
    },
    [isControlled, onChange, debounceMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return (
    <div
      className={`relative flex items-center rounded-full border ${sizeClasses[size]} ${styles.wrapper} ${className}`}
    >
      <MaterialIcon
        name="search"
        className={`mr-2 text-[1.2em] ${styles.icon}`}
      />
      <input
        type="text"
        placeholder={placeholder}
        value={isControlled ? value : internal}
        onChange={(e) => handleChange(e.target.value)}
        aria-label={ariaLabel}
        className={`w-full bg-transparent outline-none text-body-md ${styles.text} ${styles.placeholder}`}
      />
    </div>
  );
}
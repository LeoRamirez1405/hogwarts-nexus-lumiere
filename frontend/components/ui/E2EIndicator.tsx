"use client";

import { MaterialIcon } from "./MaterialIcon";

interface E2EIndicatorProps {
  encrypted: boolean;
  verified?: boolean;
  onClick?: () => void;
  className?: string;
}

export function E2EIndicator({
  encrypted,
  verified = false,
  onClick,
  className = "",
}: E2EIndicatorProps) {
  if (!encrypted) return null;

  const isInteractive = Boolean(onClick);
  const buttonClass =
    "inline-flex items-center gap-1 text-xs transition-colors " +
    (onClick ? "cursor-pointer hover:opacity-80 " : "cursor-default ") +
    (verified ? "text-secondary" : "text-on-surface-variant") + " " + className;

  const content = (
    <>
      <MaterialIcon
        name={verified ? "verified_user" : "lock"}
        className="text-[1.1em]"
      />
      <span>{verified ? "Verificado" : "Cifrado"}</span>
    </>
  );

  return (
    <span
      className={buttonClass}
      onClick={onClick}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={verified ? "Conversacion cifrada y verificada" : "Conversacion cifrada"}
    >
      {content}
    </span>
  );
}

export function E2EBadge({ encrypted }: { encrypted: boolean }) {
  if (!encrypted) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white bg-secondary/80"
      title="Mensaje cifrado E2E"
    >
      <MaterialIcon name="lock" className="text-[0.75em]" />
    </span>
  );
}

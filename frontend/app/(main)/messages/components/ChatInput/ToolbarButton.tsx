"use client";

import React from "react";
import { MaterialIcon } from "../../helpers";

interface ToolbarButtonProps {
  onClick: () => void;
  icon: string;
  label: string;
  disabled?: boolean;
}

export default function ToolbarButton({ onClick, icon, label, disabled }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-center gap-1 p-2 rounded-2xl text-on-surface-variant hover:bg-surface-container-high transition-colors disabled:opacity-40 min-w-[56px]"
      aria-label={label}
    >
      <MaterialIcon name={icon} className="text-2xl" />
      <span className="text-label-xs leading-none">{label}</span>
    </button>
  );
}
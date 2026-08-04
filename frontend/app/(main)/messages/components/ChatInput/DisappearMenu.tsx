"use client";

import React from "react";
import { MaterialIcon } from "../../helpers";

export interface DisappearOption {
  label: string;
  value: string | undefined;
}

export const disappearOptions: DisappearOption[] = [
  { label: "Desactivado", value: undefined },
  { label: "5 segundos", value: "5" },
  { label: "10 segundos", value: "10" },
  { label: "30 segundos", value: "30" },
  { label: "1 minuto", value: "60" },
  { label: "5 minutos", value: "300" },
  { label: "1 hora", value: "3600" },
  { label: "24 horas", value: "86400" },
] as const;

interface DisappearMenuProps {
  selectedValue: string | undefined;
  onChange: (value: string | undefined) => void;
  className?: string;
  buttonClassName?: string;
  mobile?: boolean;
}

export default function DisappearMenu({
  selectedValue,
  onChange,
  className = "",
  buttonClassName = "",
  mobile = false,
}: DisappearMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  const handleSelect = (e: React.MouseEvent, value: string | undefined) => {
    e.stopPropagation();
    onChange(value);
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    return disappearOptions.find((o) => String(o.value) === String(selectedValue))?.label ?? "Desactivado";
  };

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleMenu}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
          selectedValue
            ? "bg-primary/10 text-primary"
            : "bg-surface-container text-on-surface hover:bg-surface-container-high"
        } ${buttonClassName}`}
        aria-label="Mensajes que desaparecen"
      >
        <MaterialIcon name="timer" className="text-xl" />
        <span className="text-body-md">{getSelectedLabel()}</span>
      </button>
      <div
        ref={menuRef}
        className={`absolute ${mobile ? "bottom-full left-0 right-0" : "bottom-full right-0 w-40"} mb-2 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg z-[100] py-1 ${isOpen ? "" : "hidden"}`}
      >
        {disappearOptions.map((opt) => (
          <button
            key={opt.value?.toString() ?? "off"}
            type="button"
            onClick={(e) => handleSelect(e, opt.value)}
            className={`w-full ${mobile ? "px-4" : "px-3"} py-2 text-left text-body-md ${
              selectedValue === opt.value
                ? "bg-primary/10 text-primary font-medium"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
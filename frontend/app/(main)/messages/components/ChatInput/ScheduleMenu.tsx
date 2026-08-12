"use client";

import React from "react";
import { MaterialIcon } from "../../helpers";
import type { DisappearOption } from "./DisappearMenu";

export interface ScheduleOption extends DisappearOption {
  value: string | undefined;
}

export function getScheduleOptions(): ScheduleOption[] {
  const now = new Date();
  return [
    { label: "Desactivado", value: undefined },
    { label: "En 15 minutos", value: new Date(now.getTime() + 15 * 60 * 1000).toISOString() },
    { label: "En 30 minutos", value: new Date(now.getTime() + 30 * 60 * 1000).toISOString() },
    { label: "En 1 hora", value: new Date(now.getTime() + 60 * 60 * 1000).toISOString() },
    { label: "En 3 horas", value: new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString() },
    {
      label: "Mañana 9:00",
      value: (() => {
        const d = new Date(now);
        d.setDate(d.getDate() + 1);
        d.setHours(9, 0, 0, 0);
        return d.toISOString();
      })(),
    },
    { label: "Fecha personalizada…", value: "custom" },
  ] as const;
}

interface ScheduleMenuProps {
  selectedValue: string | undefined;
  onChange: (value: string | undefined) => void;
  onCustomClick: () => void;
  className?: string;
  buttonClassName?: string;
  mobile?: boolean;
}

export default function ScheduleMenu({
  selectedValue,
  onChange,
  onCustomClick,
  className = "",
  buttonClassName = "",
  mobile = false,
}: ScheduleMenuProps) {
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const scheduleOptions = getScheduleOptions();

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
    if (value === "custom") {
      onCustomClick();
    } else {
      onChange(value);
    }
    setIsOpen(false);
  };

  const getSelectedLabel = () => {
    if (selectedValue === undefined || selectedValue === "") return "Desactivado";
    if (selectedValue === "custom") return "Personalizada";
    // ISO string programado: no buscar match en el array dinamico (los timestamps cambian en cada render).
    // En su lugar, delegamos al chip externo "Programado: ..." y aquí mostramos "Programado".
    return "Programado";
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
        aria-label="Programar mensaje"
      >
        <MaterialIcon name="schedule" className="text-xl" />
        <span className="text-body-md">{getSelectedLabel()}</span>
      </button>
      <div
        ref={menuRef}
        className={`absolute ${mobile ? "bottom-full left-0 right-0" : "bottom-full right-0 w-44"} mb-2 bg-surface-container-high border border-outline-variant rounded-xl shadow-lg z-[100] py-1 ${isOpen ? "" : "hidden"}`}
      >
        {scheduleOptions.map((opt) => (
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
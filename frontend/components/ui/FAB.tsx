"use client";
import { MaterialIcon } from "./MaterialIcon";

interface FABProps {
  icon: string;
  label?: string;
  onClick?: () => void;
  position?: "bottom-right" | "bottom-center";
}

const positionClasses: Record<NonNullable<FABProps["position"]>, string> = {
  "bottom-right": "right-6 bottom-20",
  "bottom-center": "bottom-20 left-1/2 -translate-x-1/2",
};

export default function FAB({
  icon,
  label,
  onClick,
  position = "bottom-right",
}: FABProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label ?? icon}
      className={`fixed z-50 w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 ${positionClasses[position]}`}
    >
      <MaterialIcon name={icon} className="text-[1.5em]" />
    </button>
  );
}
"use client";
import { MaterialIcon } from "./MaterialIcon";
import { useVisualViewport } from "@/hooks/useVisualViewport";

interface FABProps {
  icon: string;
  label?: string;
  onClick?: () => void;
  position?: "bottom-right" | "bottom-center";
}

const positionClasses: Record<NonNullable<FABProps["position"]>, string> = {
  "bottom-right": "right-6",
  "bottom-center": "left-1/2 -translate-x-1/2",
};

export default function FAB({
  icon,
  label,
  onClick,
  position = "bottom-right",
}: FABProps) {
  const { isKeyboardOpen } = useVisualViewport();

  if (isKeyboardOpen) return null;

  return (
    <button
      onClick={onClick}
      aria-label={label ?? icon}
      className={`fixed z-50 w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-90 focus:outline-none ${positionClasses[position]} bottom-20 pb-safe`}
    >
      <MaterialIcon name={icon} className="text-[1.5em]" />
    </button>
  );
}
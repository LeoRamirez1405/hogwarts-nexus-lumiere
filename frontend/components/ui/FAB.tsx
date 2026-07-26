"use client";

interface FABProps {
  icon: string;
  onClick?: () => void;
  position?: "bottom-right" | "bottom-center";
}

const positionClasses: Record<NonNullable<FABProps["position"]>, string> = {
  "bottom-right": "right-6 bottom-20",
  "bottom-center": "bottom-20 left-1/2 -translate-x-1/2",
};

export default function FAB({
  icon,
  onClick,
  position = "bottom-right",
}: FABProps) {
  return (
    <button
      onClick={onClick}
      className={`fixed z-50 w-16 h-16 bg-primary text-on-primary rounded-full shadow-2xl flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-90 ${positionClasses[position]}`}
    >
      <span
        className="material-symbols-outlined text-[1.5em]"
        style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
      >
        {icon}
      </span>
    </button>
  );
}

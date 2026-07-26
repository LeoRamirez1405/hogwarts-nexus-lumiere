"use client";

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  variant?: "light" | "dark";
}

const sizeClasses: Record<NonNullable<SearchBarProps["size"]>, string> = {
  sm: "px-4 py-2",
  md: "px-6 py-3",
};

const variantClasses: Record<NonNullable<SearchBarProps["variant"]>, string> = {
  light: "bg-surface-container-low border-outline-variant/20",
  dark: "bg-inverse-surface border-secondary/20",
};

export default function SearchBar({
  placeholder = "Search...",
  value,
  onChange,
  size = "md",
  variant = "light",
}: SearchBarProps) {
  return (
    <div
      className={`relative flex items-center rounded-full border ${sizeClasses[size]} ${variantClasses[variant]}`}
    >
      <span
        className="material-symbols-outlined text-on-surface-variant mr-2 text-[1.2em]"
        style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
      >
        search
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full bg-transparent outline-none text-body-md text-on-surface placeholder:text-on-surface-variant/50"
      />
    </div>
  );
}

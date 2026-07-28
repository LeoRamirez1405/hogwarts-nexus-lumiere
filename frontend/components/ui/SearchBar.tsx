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

const variantClasses: Record<NonNullable<SearchBarProps["variant"]>, { wrapper: string; text: string; placeholder: string; icon: string }> = {
  light: { wrapper: "bg-surface-container-low border-outline-variant/20", text: "text-on-surface", placeholder: "placeholder:text-on-surface-variant/50", icon: "text-on-surface-variant" },
  dark: { wrapper: "bg-inverse-surface border-secondary/20", text: "text-inverse-on-surface", placeholder: "placeholder:text-inverse-on-surface/50", icon: "text-inverse-on-surface/60" },
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
      className={`relative flex items-center rounded-full border ${sizeClasses[size]} ${variantClasses[variant].wrapper}`}
    >
      <span
        className={`material-symbols-outlined ${variantClasses[variant].icon} mr-2 text-[1.2em]`}
        style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}
      >
        search
      </span>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={`w-full bg-transparent outline-none text-body-md ${variantClasses[variant].text} ${variantClasses[variant].placeholder}`}
      />
    </div>
  );
}

type Variant = "active" | "count" | "tag" | "date-separator" | "rarity";
type Color = "primary" | "secondary" | "error" | "success" | "default";

interface BadgeProps {
  variant?: Variant;
  color?: Color;
  children: React.ReactNode;
}

const rarityColors: Record<Color, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/10 text-secondary",
  error: "bg-error/10 text-error",
  success: "bg-success/10 text-success",
  default: "bg-surface-container-high text-on-surface-variant",
};

export default function Badge({
  variant = "tag",
  color = "default",
  children,
}: BadgeProps) {
  if (variant === "active") {
    return (
      <span className="inline-flex items-center bg-green-100 text-green-700 text-[10px] px-2 py-1 rounded-full font-bold">
        {children}
      </span>
    );
  }

  if (variant === "count") {
    return (
      <span className="inline-flex items-center justify-center bg-primary text-white text-[10px] w-5 h-5 rounded-full">
        {children}
      </span>
    );
  }

  if (variant === "tag") {
    return (
      <span className="inline-flex items-center text-label-sm px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
        {children}
      </span>
    );
  }

  if (variant === "date-separator") {
    return (
      <span className="inline-flex items-center bg-surface-container-high px-4 py-1 rounded-full text-on-surface-variant text-label-sm">
        {children}
      </span>
    );
  }

  if (variant === "rarity") {
    return (
      <span
        className={`inline-flex items-center text-label-sm uppercase tracking-wider px-3 py-1 rounded-full font-medium ${rarityColors[color]}`}
      >
        {children}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center text-label-sm px-3 py-1 rounded-full bg-surface-container-high text-on-surface-variant">
      {children}
    </span>
  );
}

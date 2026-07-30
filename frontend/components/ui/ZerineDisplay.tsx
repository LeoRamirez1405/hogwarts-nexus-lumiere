type Size = "sm" | "md" | "lg" | "hero";
type Variant = "balance" | "price" | "delta";
type IconStyle = "emoji" | "icon";

interface ZerineDisplayProps {
  amount: number;
  size?: Size;
  variant?: Variant;
  iconStyle?: IconStyle;
}

const sizeClasses: Record<Size, string> = {
  sm: "text-label-sm",
  md: "text-body-md",
  lg: "text-title-md",
  hero: "text-display-lg font-display",
};

function DiamondIcon({ style }: { style: IconStyle }) {
  if (style === "emoji") {
    return (
      <span className="material-symbols-outlined text-[0.85em] mr-1 align-middle" style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}>
        diamond
      </span>
    );
  }
  return (
    <span
      className="material-symbols-outlined text-[1em] mr-1 align-middle"
      style={{ fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 24' }}
    >
      diamond
    </span>
  );
}

export default function ZerineDisplay({
  amount,
  size = "md",
  variant = "balance",
  iconStyle = "icon",
}: ZerineDisplayProps) {
  const formatted = amount.toLocaleString();

  if (variant === "price") {
    return (
      <span className={`inline-flex items-center text-secondary ${sizeClasses[size]}`}>
        <DiamondIcon style={iconStyle} />
        {formatted}
      </span>
    );
  }

  if (variant === "delta") {
    const isPositive = amount >= 0;
    const prefix = isPositive ? "+" : "";
    const colorClass = isPositive ? "text-success" : "text-error";
    return (
      <span className={`inline-flex items-center font-medium ${colorClass} ${sizeClasses[size]}`}>
        {prefix}{formatted}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center ${sizeClasses[size]}`}>
      {formatted}
    </span>
  );
}
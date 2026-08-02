import { MaterialIcon } from "./MaterialIcon";

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

function DiamondIcon({ className }: { className?: string }) {
  return (
    <MaterialIcon
      name="diamond"
      filled
      inline
      className={className ?? "text-[0.85em] mr-1"}
    />
  );
}

export default function ZerineDisplay({
  amount,
  size = "md",
  variant = "balance",
}: ZerineDisplayProps) {
  const formatted = amount.toLocaleString();

  if (variant === "price") {
    return (
      <span className={`inline-flex items-center text-secondary ${sizeClasses[size]}`}>
        <DiamondIcon />
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
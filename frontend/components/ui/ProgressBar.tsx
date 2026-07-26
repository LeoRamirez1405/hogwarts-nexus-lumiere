"use client";

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: "primary" | "secondary" | "success" | "error";
  size?: "sm" | "md" | "lg";
  label?: string;
  showValue?: boolean;
}

const trackColors: Record<NonNullable<ProgressBarProps["color"]>, string> = {
  primary: "bg-primary/10",
  secondary: "bg-secondary/10",
  success: "bg-success/10",
  error: "bg-error/10",
};

const fillColors: Record<NonNullable<ProgressBarProps["color"]>, string> = {
  primary: "bg-primary shadow-[0_0_8px_rgba(14,59,96,0.3)]",
  secondary: "bg-secondary shadow-[0_0_8px_rgba(119,90,25,0.3)]",
  success: "bg-success shadow-[0_0_8px_rgba(22,163,74,0.3)]",
  error: "bg-error shadow-[0_0_8px_rgba(186,26,26,0.3)]",
};

const sizeClasses: Record<NonNullable<ProgressBarProps["size"]>, string> = {
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
};

export default function ProgressBar({
  value,
  max = 100,
  color = "primary",
  size = "md",
  label,
  showValue = false,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && (
            <span className="text-label-sm text-on-surface-variant">{label}</span>
          )}
          {showValue && (
            <span className="text-label-sm text-on-surface-variant">
              {Math.round(percentage)}%
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full rounded-full overflow-hidden ${trackColors[color]} ${sizeClasses[size]}`}
      >
        <div
          className={`h-full rounded-full transition-all duration-1000 ${fillColors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

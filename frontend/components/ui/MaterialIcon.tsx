"use client";

export function MaterialIcon({
  name,
  className,
  filled = false,
  inline = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
  inline?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
        verticalAlign: inline ? "middle" : "baseline",
        lineHeight: inline ? "1" : "normal",
      }}
    >
      {name}
    </span>
  );
}
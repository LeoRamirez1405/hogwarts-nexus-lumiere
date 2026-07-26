"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "crystal" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconPosition?: "left" | "right";
}

const variantStyles: Record<Variant, string> = {
  primary: "bg-primary text-on-primary hover:opacity-90",
  secondary: "bg-secondary text-on-secondary hover:opacity-90",
  ghost: "text-on-surface-variant hover:bg-surface-container-high",
  outline:
    "border border-outline-variant text-on-surface-variant hover:bg-surface-container-high",
  crystal: "crystal-gradient text-on-primary hover:opacity-90",
  danger: "bg-error text-on-error hover:opacity-90",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-2 text-label-sm",
  md: "px-6 py-3 text-body-md",
  lg: "px-8 py-4 text-title-md",
};

function MaterialIcon({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-outlined ${className ?? ""}`} style={{ fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24' }}>
      {name}
    </span>
  );
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {icon && iconPosition === "left" && (
          <MaterialIcon name={icon} className="text-[1.1em]" />
        )}
        {children}
        {icon && iconPosition === "right" && (
          <MaterialIcon name={icon} className="text-[1.1em]" />
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;

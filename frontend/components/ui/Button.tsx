"use client";
import { ButtonHTMLAttributes, forwardRef } from "react";
import { MaterialIcon } from "./MaterialIcon";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "crystal" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  iconPosition?: "left" | "right";
  loading?: boolean;
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

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      icon,
      iconPosition = "left",
      loading = false,
      className = "",
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        className={`inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <MaterialIcon
            name="progress_activity"
            className="text-[1.1em] animate-spin"
          />
        ) : (
          icon &&
          iconPosition === "left" && (
            <MaterialIcon name={icon} className="text-[1.1em]" />
          )
        )}
        {children}
        {icon && iconPosition === "right" && !loading && (
          <MaterialIcon name={icon} className="text-[1.1em]" />
        )}
     </button>
    );
  }
);

Button.displayName = "Button";

export default Button;

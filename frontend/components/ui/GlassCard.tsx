"use client";
import { HTMLAttributes, forwardRef } from "react";

type Variant = "default" | "tinted" | "dark";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  hover?: boolean;
  glow?: boolean;
}

const variantClasses: Record<Variant, string> = {
  default: "glass-card",
  tinted: "glass-card glass-card--tinted",
  dark: "glass-card glass-card--dark",
};

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      variant = "default",
      hover = false,
      glow = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`rounded-xl transition-all duration-300 ${variantClasses[variant]} ${hover ? "hover:-translate-y-2" : ""} ${glow ? "nexus-glow" : ""} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

GlassCard.displayName = "GlassCard";

export default GlassCard;

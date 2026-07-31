import { HTMLAttributes, forwardRef } from "react";

type SkeletonVariant = "card" | "table-row" | "avatar" | "text";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
}

function variantClasses(variant: SkeletonVariant): string {
  switch (variant) {
    case "card":
      return "rounded-xl bg-surface-container-high p-6 space-y-3";
    case "table-row":
      return "flex items-center gap-4 p-4";
    case "avatar":
      return "w-10 h-10 rounded-full bg-outline-variant/30 shrink-0";
    case "text":
    default:
      return "h-4 bg-outline-variant/30 rounded";
  }
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  ({ variant = "text", className = "", children, ...props }, ref) => {
    if (variant === "card") {
      return (
        <div
          ref={ref}
          className={`animate-pulse ${variantClasses(variant)} ${className}`}
          {...props}
        >
          <div className="h-4 bg-outline-variant/30 rounded w-1/2" />
          <div className="h-8 bg-outline-variant/30 rounded w-1/3" />
        </div>
      );
    }

    if (variant === "table-row") {
      return (
        <div
          ref={ref}
          className={`animate-pulse ${variantClasses(variant)} ${className}`}
          {...props}
        >
          <div className="w-10 h-10 rounded-full bg-outline-variant/30 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
            <div className="h-3 bg-outline-variant/30 rounded w-1/2" />
          </div>
          <div className="h-4 bg-outline-variant/30 rounded w-16" />
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={`animate-pulse ${variantClasses(variant)} ${className}`}
        {...props}
      >
        {variant === "avatar" ? null : children}
      </div>
    );
  }
);

Skeleton.displayName = "Skeleton";

export default Skeleton;
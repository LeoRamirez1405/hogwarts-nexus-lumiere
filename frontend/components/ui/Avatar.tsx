"use client";
import { useState, HTMLAttributes, forwardRef } from "react";
import Image from "next/image";
import { mediaSrc, isProxiedUpload } from "@/lib/media";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  src?: string;
  alt?: string;
  size?: Size;
  borderColor?: "primary" | "secondary" | "none";
  status?: "online" | "away" | "offline";
  initials?: string;
}

const sizeClasses: Record<Size, string> = {
  xs: "w-8 h-8",
  sm: "w-10 h-10",
  md: "w-12 h-12",
  lg: "w-16 h-16",
  xl: "w-32 h-32 md:w-40 md:h-40",
};

const borderWidthClasses: Record<
  NonNullable<AvatarProps["borderColor"]>,
  string
> = {
  primary: "ring-2 ring-primary",
  secondary: "ring-2 ring-secondary",
  none: "",
};

const statusColors: Record<NonNullable<AvatarProps["status"]>, string> = {
  online: "bg-success",
  away: "bg-secondary",
  offline: "bg-outline",
};

const Avatar = forwardRef<HTMLDivElement, AvatarProps>(
  (
    {
      src,
      alt,
      size = "md",
      borderColor = "none",
      status,
      initials,
      className = "",
      ...props
    },
    ref
  ) => {
    const [imgError, setImgError] = useState(false);

    return (
      <div
        ref={ref}
        className={`relative inline-flex items-center justify-center rounded-full bg-surface-container-high ${sizeClasses[size]} ${borderWidthClasses[borderColor]} ${className}`}
        {...props}
      >
        <div className="absolute inset-0 rounded-full overflow-hidden flex items-center justify-center">
          {src && !imgError ? (
            <Image
              src={mediaSrc(src)}
              alt={alt ?? ""}
              fill
              sizes={
                size === "xl" ? "160px" : size === "lg" ? "64px" : "48px"
              }
              className="object-cover"
              loading="lazy"
              unoptimized={isProxiedUpload(src)}
              onError={() => setImgError(true)}
            />
          ) : (
          <span className="text-on-surface-variant font-medium text-[0.85em] select-none">
              {initials ?? "?"}
            </span>
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-surface ${statusColors[status]}`}
        />
      )}
    </div>
  );
  }
);

Avatar.displayName = "Avatar";

export default Avatar;
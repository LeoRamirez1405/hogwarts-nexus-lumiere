"use client";

import { HTMLAttributes, forwardRef, useEffect, useState } from "react";

type SkeletonVariant =
  | "card"
  | "table-row"
  | "avatar"
  | "text"
  | "circular"
  | "rectangular"
  | "list-item"
  | "post"
  | "product"
  | "article"
  | "notification"
  | "chat-message"
  | "sidebar-item";

interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  lines?: number;
  width?: string | number;
  height?: string | number;
  showAnimation?: boolean;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window !== "undefined") {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }
    return false;
  });
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function variantClasses(variant: SkeletonVariant): string {
  switch (variant) {
    case "card":
      return "rounded-xl bg-surface-container-high p-6 space-y-3";
    case "table-row":
      return "flex items-center gap-4 p-4";
    case "avatar":
      return "w-10 h-10 rounded-full bg-outline-variant/30 shrink-0";
    case "circular":
      return "rounded-full bg-outline-variant/30 shrink-0";
    case "rectangular":
      return "rounded-xl bg-outline-variant/30";
    case "list-item":
      return "flex items-center gap-3 p-4 rounded-xl bg-surface-container-high";
    case "post":
      return "rounded-xl bg-surface-container-high p-6 space-y-4";
    case "product":
      return "bg-surface-container-high rounded-2xl p-4 space-y-3";
    case "article":
      return "glass-card rounded-3xl p-6 space-y-4";
    case "notification":
      return "flex items-start gap-3 px-4 py-3 rounded-xl bg-surface-container-high";
    case "chat-message":
      return "flex items-start gap-2 p-4 rounded-xl bg-surface-container-high";
    case "sidebar-item":
      return "flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-container-high";
    case "text":
    default:
      return "h-4 bg-outline-variant/30 rounded";
  }
}

function renderSkeletonContent(variant: SkeletonVariant, lines: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];

  switch (variant) {
    case "card": {
      nodes.push(<div key="title" className="h-5 bg-outline-variant/30 rounded w-1/2" />);
      nodes.push(<div key="meta" className="h-4 bg-outline-variant/30 rounded w-1/3" />);
      for (let i = 0; i < (lines ?? 3); i++) {
        nodes.push(<div key={`line-${i}`} className="h-4 bg-outline-variant/30 rounded" />);
      }
      break;
    }
    case "post": {
      nodes.push(
        <div key="header" className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-outline-variant/30 shrink-0" />
          <div className="flex-1 space-y-1">
            <div className="h-5 bg-outline-variant/30 rounded w-1/4" />
            <div className="h-3 bg-outline-variant/30 rounded w-1/3" />
          </div>
        </div>
      );
      for (let i = 0; i < (lines ?? 3); i++) {
        nodes.push(<div key={`body-${i}`} className="h-5 bg-outline-variant/30 rounded" />);
      }
      nodes.push(
        <div key="actions" className="flex items-center gap-4 pt-2 border-t border-outline-variant/20">
          {[1, 2, 3, 4].map((j) => (
            <div key={j} className="h-5 w-20 bg-outline-variant/30 rounded flex items-center gap-1" />
          ))}
        </div>
      );
      break;
    }
    case "product": {
      nodes.push(<div key="image" className="aspect-square w-full rounded-xl bg-outline-variant/30" />);
      nodes.push(<div key="title" className="h-5 bg-outline-variant/30 rounded w-3/4" />);
      nodes.push(<div key="price" className="h-6 bg-outline-variant/30 rounded w-1/4" />);
      break;
    }
    case "article": {
      nodes.push(<div key="image" className="aspect-[16/9] w-full rounded-xl bg-outline-variant/30" />);
      nodes.push(<div key="category" className="h-4 bg-outline-variant/30 rounded w-1/5" />);
      nodes.push(<div key="title" className="h-7 bg-outline-variant/30 rounded w-full" />);
      nodes.push(<div key="excerpt" className="h-4 bg-outline-variant/30 rounded w-5/6" />);
      nodes.push(<div key="meta" className="h-3 bg-outline-variant/30 rounded w-1/3" />);
      break;
    }
    case "table-row": {
      nodes.push(<div key="avatar" className="w-10 h-10 rounded-full bg-outline-variant/30 shrink-0" />);
      nodes.push(
        <div key="content" className="flex-1 space-y-2">
          <div className="h-4 bg-outline-variant/30 rounded w-1/2" />
          <div className="h-3 bg-outline-variant/30 rounded w-3/4" />
        </div>
      );
      nodes.push(<div key="actions" className="h-5 bg-outline-variant/30 rounded w-16 shrink-0" />);
      break;
    }
    case "list-item": {
      nodes.push(<div key="icon" className="w-10 h-10 rounded-full bg-outline-variant/30 shrink-0" />);
      nodes.push(<div key="text" className="flex-1 h-5 bg-outline-variant/30 rounded" />);
      break;
    }
    case "notification": {
      nodes.push(<div key="icon" className="w-9 h-9 rounded-full bg-outline-variant/30 shrink-0" />);
      nodes.push(
        <div key="content" className="flex-1 min-w-0 space-y-1">
          <div className="h-5 bg-outline-variant/30 rounded w-1/2" />
          <div className="h-4 bg-outline-variant/30 rounded w-3/4" />
          <div className="h-3 bg-outline-variant/30 rounded w-1/4" />
        </div>
      );
      break;
    }
    case "chat-message": {
      nodes.push(<div key="avatar" className="w-8 h-8 rounded-full bg-outline-variant/30 shrink-0" />);
      nodes.push(
        <div key="bubble" className="flex-1 space-y-1">
          <div className="h-4 bg-outline-variant/30 rounded w-1/3" />
          <div className="h-5 bg-outline-variant/30 rounded w-3/4" />
        </div>
      );
      break;
    }
    case "sidebar-item": {
      nodes.push(<div key="icon" className="w-6 h-6 rounded bg-outline-variant/30 shrink-0" />);
      nodes.push(<div key="label" className="flex-1 h-4 bg-outline-variant/30 rounded" />);
      break;
    }
    case "avatar": {
      // No content, just the circle
      break;
    }
    case "circular": {
      break;
    }
    case "rectangular": {
      break;
    }
    case "text":
    default: {
      for (let i = 0; i < (lines ?? 1); i++) {
        nodes.push(
          <div
            key={`line-${i}`}
            className={`h-4 bg-outline-variant/30 rounded ${i < (lines ?? 1) - 1 ? "mt-2" : ""}`}
            style={{ width: i === (lines ?? 1) - 1 ? "60%" : "100%" }}
          />
        );
      }
    }
  }
  return nodes;
}

const Skeleton = forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = "text",
      className = "",
      // children is intentionally unused - content is generated by variant
      lines = 1,
      width,
      height,
      showAnimation = true,
      ...props
    },
    ref
  ) => {
    const reducedMotion = useReducedMotion();
    const shouldAnimate = showAnimation && !reducedMotion;

    return (
      <div
        ref={ref}
        className={`${shouldAnimate ? "skeleton-shimmer" : "opacity-50"} ${variantClasses(variant)} ${className}`}
        style={{
          width,
          height,
          ...props.style,
        }}
        {...props}
      >
        {variant === "avatar" || variant === "circular" || variant === "rectangular" ? null : renderSkeletonContent(variant, lines)}
      </div>
    );
  }
);

Skeleton.displayName = "Skeleton";

export default Skeleton;
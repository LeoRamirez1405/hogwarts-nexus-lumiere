"use client";

import { forwardRef, useImperativeHandle, useRef, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import { usePullToRefresh, PullToRefreshOptions } from "@/hooks/useGestures";
import { useReducedMotion } from "@/hooks/useGestures";

export interface PullToRefreshHandle {
  triggerRefresh: () => void;
}

interface PullToRefreshProps extends Omit<PullToRefreshOptions, "onRefresh"> {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  indicator?: React.ReactNode;
}

export const PullToRefresh = forwardRef<PullToRefreshHandle, PullToRefreshProps>(
  function PullToRefresh({ children, onRefresh, threshold = 80, disabled = false, indicator }, ref) {
    const prefersReducedMotion = useReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);

    const { onTouchStart, onTouchMove, onTouchEnd, pullProgress, isRefreshing } = usePullToRefresh({
      onRefresh,
      threshold,
      disabled: disabled || prefersReducedMotion,
    });

    const triggerRefresh = useCallback(async () => {
      if (isRefreshing) return;
      // Manually trigger refresh
      // Note: This is a simplified version - in real use you'd want to animate
      await onRefresh();
    }, [onRefresh, isRefreshing]);

    useImperativeHandle(ref, () => ({
      triggerRefresh,
    }), [triggerRefresh]);

    const indicatorHeight = 60;
    const translateY = Math.min(pullProgress * indicatorHeight, indicatorHeight * 1.5);

    return (
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <div
          className="absolute top-0 left-0 right-0 -translate-y-full transition-transform duration-200 ease-out flex items-center justify-center"
          style={{
            transform: `translateY(calc(-100% + ${translateY}px))`,
            height: indicatorHeight,
          }}
          aria-hidden="true"
        >
          <div
            className={`flex flex-col items-center gap-2 transition-all duration-200 ${
              pullProgress >= 1 ? "opacity-100" : "opacity-0"
            }`}
            style={{
              opacity: pullProgress,
              transform: `scale(${0.5 + pullProgress * 0.5})`,
            }}
          >
            {indicator || (
              <>
                <span
                  className="text-primary text-3xl transition-transform duration-200"
                  style={{
                    transform: `rotate(${pullProgress >= 1 ? 180 : 0}deg)`,
                  }}
                >
                  <MaterialIcon name="expand_more" />
                </span>
                <span className="text-label-sm text-on-surface-variant">
                  {pullProgress >= 1 ? "Soltar para actualizar" : "Tira para actualizar"}
                </span>
              </>
            )}
            {isRefreshing && (
              <MaterialIcon
                name="progress_activity"
                className="text-primary text-3xl animate-spin"
              />
            )}
          </div>
        </div>

        <div
          className="transition-transform duration-300 ease-out"
          style={{
            transform: `translateY(${Math.min(pullProgress * indicatorHeight * 0.5, indicatorHeight * 0.5)}px)`,
          }}
        >
          {children}
        </div>
      </div>
    );
  }
);

PullToRefresh.displayName = "PullToRefresh";
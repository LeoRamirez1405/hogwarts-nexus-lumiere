"use client";

import { useCallback, useRef, useState } from "react";
import { useHaptics } from "@/hooks/useHaptics";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  disabled?: boolean;
}

export default function PullToRefresh({
  onRefresh,
  children,
  threshold = 80,
  disabled = false,
}: PullToRefreshProps) {
  const { light } = useHaptics();
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef<number | null>(null);
  const isPulling = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const scrollTop = containerRef.current?.scrollTop ?? 0;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - (startY.current ?? 0);
    if (deltaY > 0) {
      e.preventDefault();
      const progress = Math.min(deltaY / threshold, 1.5);
      setPullProgress(progress);
    }
  }, [disabled, isRefreshing, threshold]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled || isRefreshing) return;
    isPulling.current = false;
    startY.current = null;

    if (pullProgress >= 1) {
      light();
      setIsRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullProgress(0);
      }
    } else {
      setPullProgress(0);
    }
  }, [disabled, isRefreshing, onRefresh, pullProgress, light]);

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="overflow-y-auto flex-1"
      style={{ overflow: "auto" }}
    >
      <div className="relative">
        {pullProgress > 0 && (
          <div
            className="absolute top-0 left-0 right-0 -translate-y-full flex items-center justify-center pointer-events-none transition-transform duration-200"
            style={{
              transform: `translateY(${Math.min(pullProgress * 60, 90)}px)`,
              opacity: pullProgress,
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <div
                className="rounded-full border-2 border-primary/30"
                style={{
                  width: 24 + pullProgress * 16,
                  height: 24 + pullProgress * 16,
                }}
              >
                <span
                  className="material-symbols-outlined text-primary"
                  style={{
                    display: "block",
                    transform: `rotate(${pullProgress * 180}deg)`,
                    fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                    verticalAlign: "baseline",
                    lineHeight: "normal",
                  }}
                >
                  arrow_downward
                </span>
              </div>
              {pullProgress >= 1 && (
                <span className="text-label-sm text-primary font-medium">
                  Suelta para actualizar
                </span>
              )}
            </div>
          </div>
        )}
        {isRefreshing && (
          <div
            className="absolute top-0 left-0 right-0 -translate-y-full flex items-center justify-center pointer-events-none"
            style={{ transform: "translateY(60px)" }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                className="material-symbols-outlined text-primary text-[1.5em] animate-spin"
                style={{
                  fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
                  verticalAlign: "baseline",
                  lineHeight: "normal",
                }}
              >
                progress_activity
              </span>
              <span className="text-label-sm text-on-surface-variant">
                Actualizando...
              </span>
            </div>
          </div>
        )}
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
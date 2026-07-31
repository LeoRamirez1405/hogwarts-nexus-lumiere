"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface SwipeableOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeUp?: () => void;
  onSwipeDown?: () => void;
  threshold?: number;
  preventScroll?: boolean;
  disabled?: boolean;
}

export interface SwipeableReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
}

export function useSwipeable(options: SwipeableOptions = {}): SwipeableReturn {
  const {
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    threshold = 50,
    preventScroll = false,
    disabled = false,
  } = options;

  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const isTracking = useRef(false);
  const isSwiping = useRef(false);
  const preventScrollRef = useRef(preventScroll);

  useEffect(() => {
    preventScrollRef.current = preventScroll;
  }, [preventScroll]);

  const reset = useCallback(() => {
    startX.current = null;
    startY.current = null;
    isTracking.current = false;
    isSwiping.current = false;
  }, []);

  const handleStart = useCallback((clientX: number, clientY: number) => {
    if (disabled) return;
    startX.current = clientX;
    startY.current = clientY;
    isTracking.current = true;
    isSwiping.current = false;
  }, [disabled]);

  const handleMove = useCallback((clientX: number, clientY: number, e?: React.TouchEvent | React.MouseEvent) => {
    if (!isTracking.current || disabled) return;

    const deltaX = clientX - (startX.current ?? 0);
    const deltaY = clientY - (startY.current ?? 0);
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!isSwiping.current && (absX > 10 || absY > 10)) {
      isSwiping.current = true;
    }

    if (isSwiping.current && preventScrollRef.current && absX > absY) {
      e?.preventDefault();
    }
  }, [disabled]);

  const handleEnd = useCallback(() => {
    if (!isSwiping.current || disabled) {
      reset();
      return;
    }

    const deltaX = (startX.current ?? 0) - (startX.current ?? 0);
    const deltaY = (startY.current ?? 0) - (startY.current ?? 0);
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX > absY && absX > threshold) {
      if (deltaX > 0) {
        onSwipeLeft?.();
      } else {
        onSwipeRight?.();
      }
    } else if (absY > absX && absY > threshold) {
      if (deltaY > 0) {
        onSwipeUp?.();
      } else {
        onSwipeDown?.();
      }
    }

    reset();
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold, disabled, reset]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart(e.touches[0].clientX, e.touches[0].clientY);
  }, [handleStart]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    handleMove(e.touches[0].clientX, e.touches[0].clientY, e);
  }, [handleMove]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    handleStart(e.clientX, e.clientY);
  }, [handleStart]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    handleMove(e.clientX, e.clientY, e);
  }, [handleMove]);

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    reset();
  }, [reset]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onMouseLeave,
  };
}

export interface PullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export interface PullToRefreshReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  pullProgress: number;
  isRefreshing: boolean;
}

export function usePullToRefresh(options: PullToRefreshOptions): PullToRefreshReturn {
  const { onRefresh, threshold = 80, disabled = false } = options;

  const startY = useRef<number | null>(null);
  const [pullProgress, setPullProgress] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const isPulling = useRef(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
    isPulling.current = true;
  }, [disabled, isRefreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling.current || disabled || isRefreshing) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - (startY.current ?? 0);
    if (deltaY > 0) {
      e.preventDefault();
      const progress = Math.min(deltaY / threshold, 1.5);
      setPullProgress(progress);
    }
  }, [disabled, isRefreshing, threshold]);

  const onTouchEnd = useCallback(async () => {
    if (!isPulling.current || disabled || isRefreshing) return;
    isPulling.current = false;
    startY.current = null;

    if (pullProgress >= 1) {
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
  }, [disabled, isRefreshing, onRefresh, pullProgress]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    pullProgress,
    isRefreshing,
  };
}

export interface LongPressOptions {
  onLongPress: () => void;
  delay?: number;
  disabled?: boolean;
}

export interface LongPressReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: () => void;
  onTouchCancel: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  onMouseLeave: () => void;
}

export function useLongPress(options: LongPressOptions): LongPressReturn {
  const { onLongPress, delay = 500, disabled = false } = options;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = useCallback(() => {
    if (disabled) return;
    clearTimer();
    timerRef.current = setTimeout(() => {
      onLongPress();
      clearTimer();
    }, delay);
  }, [disabled, onLongPress, delay, clearTimer]);

  const handleEnd = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    handleStart();
  }, [handleStart]);

  const onTouchEnd = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onTouchCancel = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    handleStart();
  }, [handleStart]);

  const onMouseUp = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  const onMouseLeave = useCallback(() => {
    handleEnd();
  }, [handleEnd]);

  useEffect(() => clearTimer, [clearTimer]);

  return {
    onTouchStart,
    onTouchEnd,
    onTouchCancel,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
  };
}

export interface PinchZoomState {
  scale: number;
  translateX: number;
  translateY: number;
}

export interface PinchZoomReturn {
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchMove: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  state: PinchZoomState;
  reset: () => void;
}

function getDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

function getMidpoint(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}

export function usePinchZoom(minScale = 1, maxScale = 4): PinchZoomReturn {
  const [state, setState] = useState<PinchZoomState>({
    scale: 1,
    translateX: 0,
    translateY: 0,
  });

  const initialDistance = useRef<number | null>(null);
  const initialScale = useRef(1);
  const initialMidpoint = useRef<{ x: number; y: number } | null>(null);
  const initialTranslate = useRef({ x: 0, y: 0 });
  const isPinching = useRef(false);

  const reset = useCallback(() => {
    setState({ scale: 1, translateX: 0, translateY: 0 });
    initialDistance.current = null;
    initialScale.current = 1;
    initialMidpoint.current = null;
    initialTranslate.current = { x: 0, y: 0 };
    isPinching.current = false;
  }, []);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      isPinching.current = true;
      const t0 = e.touches[0] as unknown as Touch;
      const t1 = e.touches[1] as unknown as Touch;
      initialDistance.current = getDistance(t0, t1);
      initialScale.current = state.scale;
      initialMidpoint.current = getMidpoint(t0, t1);
      initialTranslate.current = { x: state.translateX, y: state.translateY };
    }
  }, [state.scale, state.translateX, state.translateY]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPinching.current || e.touches.length !== 2 || !initialDistance.current) return;

    e.preventDefault();

    const t0 = e.touches[0] as unknown as Touch;
    const t1 = e.touches[1] as unknown as Touch;
    const currentDistance = getDistance(t0, t1);
    const scale = Math.min(maxScale, Math.max(minScale, initialScale.current * (currentDistance / initialDistance.current)));

    if (initialMidpoint.current) {
      const currentMidpoint = getMidpoint(t0, t1);
      const dx = currentMidpoint.x - initialMidpoint.current.x;
      const dy = currentMidpoint.y - initialMidpoint.current.y;

      setState({
        scale,
        translateX: initialTranslate.current.x + dx,
        translateY: initialTranslate.current.y + dy,
      });
    } else {
      setState((prev) => ({ ...prev, scale }));
    }
  }, [maxScale, minScale]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      isPinching.current = false;
      initialDistance.current = null;
      initialMidpoint.current = null;
    }
  }, []);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    state,
    reset,
  };
}

export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const prefersReducedMotionRef = useRef(prefersReducedMotion);

  useEffect(() => {
    prefersReducedMotionRef.current = prefersReducedMotion;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const initialMatches = mediaQuery.matches;
    if (initialMatches !== prefersReducedMotionRef.current) {
      setPrefersReducedMotion(initialMatches);
    }

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}
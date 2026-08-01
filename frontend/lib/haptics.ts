"use client";

/**
 * Haptic feedback utilities for mobile interactions.
 * Uses navigator.vibrate() with patterns that work on iOS (via WebKit)
 * and Android.
 */

type HapticPattern =
  | "light"      // Short, light tap
  | "medium"     // Medium tap
  | "heavy"      // Strong tap
  | "selection"  // Selection change (subtle)
  | "success"    // Success pattern
  | "warning"    // Warning pattern
  | "error";     // Error pattern

const patterns: Record<HapticPattern, number[]> = {
  light: [10],
  medium: [20],
  heavy: [40],
  selection: [5],
  success: [30, 20, 30],
  warning: [50, 30, 50, 30, 50],
  error: [100, 50, 100],
};

/**
 * Trigger haptic feedback if supported.
 * On iOS, this requires a user gesture context (touch/click handler).
 */
export function haptic(pattern: HapticPattern): void {
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    navigator.vibrate(patterns[pattern]);
  }
}

/**
 * Convenience hooks for common haptic patterns.
 * These must be called from within a user interaction handler (onClick, onTouchStart, etc.)
 */
export function hapticLight() { haptic("light"); }
export function hapticMedium() { haptic("medium"); }
export function hapticHeavy() { haptic("heavy"); }
export function hapticSelection() { haptic("selection"); }
export function hapticSuccess() { haptic("success"); }
export function hapticWarning() { haptic("warning"); }
export function hapticError() { haptic("error"); }

/**
 * Hook to add haptic feedback to any click handler.
 * Usage: onClick={withHaptic(handleClick, "light")}
 */
export function withHaptic<T extends (...args: unknown[]) => unknown>(
  handler: T,
  pattern: HapticPattern = "light"
): T {
  return ((...args: unknown[]) => {
    haptic(pattern);
    return handler(...args);
  }) as T;
}

/**
 * Hook to add haptic feedback to onTouchStart (for immediate feedback).
 * Usage: onTouchStart={withHapticTouch(handleClick, "selection")}
 */
export function withHapticTouch<T extends (...args: unknown[]) => unknown>(
  handler: T,
  pattern: HapticPattern = "selection"
): T {
  return ((...args: unknown[]) => {
    haptic(pattern);
    return handler(...args);
  }) as T;
}
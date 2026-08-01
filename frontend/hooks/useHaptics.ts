"use client";

/**
 * Lightweight haptic feedback hook. Works on mobile browsers that support
 * the Vibration API (Android) and degrades silently on desktop/iOS.
 *
 * Patterns:
 *   haptic.light()        – short pulse (selection, success)
 *   haptic.medium()       – moderate (like, follow, send)
 *   haptic.heavy()        – strong (delete, destructive action)
 *   haptic.error()        – triple pulse (error alert)
 *   haptic.selection()    – tactile selection (dropdown, picker)
 *
 * Vibration API reference:
 *   https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
 */
export function useHaptics() {
  const vibrate = (pattern: number | number[]) => {
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  return {
    light: () => vibrate(10),
    medium: () => vibrate(20),
    heavy: () => vibrate([30, 50, 30]),
    error: () => vibrate([100, 50, 100]),
    selection: () => vibrate(15),
  };
}
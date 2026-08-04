"use client";

import { haptic } from "@/lib/haptics";

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
  return {
    light: () => haptic("light"),
    medium: () => haptic("medium"),
    heavy: () => haptic("heavy"),
    error: () => haptic("error"),
    selection: () => haptic("selection"),
    success: () => haptic("success"),
    warning: () => haptic("warning"),
  };
}
"use client";

import { useCallback } from "react";
import { haptic, type HapticPattern } from "@/lib/haptics";

export function useHapticFeedback(pattern: HapticPattern = "light"): () => void {
  return useCallback(() => {
    haptic(pattern);
  }, [pattern]);
}

export function useHapticSelection(): () => void {
  return useHapticFeedback("selection");
}

export function useHapticLight(): () => void {
  return useHapticFeedback("light");
}

export function useHapticMedium(): () => void {
  return useHapticFeedback("medium");
}

export function useHapticHeavy(): () => void {
  return useHapticFeedback("heavy");
}

export function useHapticSuccess(): () => void {
  return useHapticFeedback("success");
}

export function useHapticWarning(): () => void {
  return useHapticFeedback("warning");
}

export function useHapticError(): () => void {
  return useHapticFeedback("error");
}
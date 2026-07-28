"use client";

import { useSyncExternalStore } from "react";
import type { Theme } from "./fallbacks";

/**
 * Reactive light/dark theme resolver for choosing fallback assets.
 *
 * Uses `useSyncExternalStore` instead of the old `useState` + `useEffect`
 * (which called `setState` synchronously inside the effect) so it is free of
 * the `react-hooks/set-state-in-effect` pitfall and renders a stable value on
 * the server. Resolution: an explicit `.dark` class on <html> wins, otherwise
 * it follows the OS `prefers-color-scheme`.
 */

function subscribe(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}

function getSnapshot(): Theme {
  if (document.documentElement.classList.contains("dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

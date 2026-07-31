"use client";

import { useEffect, useState } from "react";

/** Returns a debounced copy of `value` that only updates after `delay` ms of
 * inactivity. Use it to avoid re-filtering large client-side lists on every
 * keystroke. */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

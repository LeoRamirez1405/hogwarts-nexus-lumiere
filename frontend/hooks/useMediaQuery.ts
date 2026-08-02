"use client";

import { useEffect, useState } from "react";

/**
 * SSR-safe media query hook. Returns true on the client once the query matches,
 * and the given `initialValue` during SSR / before hydration to avoid
 * hydration mismatches.
 */
export function useMediaQuery(query: string, initialValue = false): boolean {
  const [matches, setMatches] = useState(initialValue);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** `true` when viewport is >= the Tailwind `md` breakpoint (768px). */
export function useIsDesktopMdUp(initial = true): boolean {
  return useMediaQuery("(min-width: 768px)", initial);
}

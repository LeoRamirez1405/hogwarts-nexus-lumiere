"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Returns a ref callback that starts prefetching a route on touchStart
 * (touch devices) or on pointer hover (desktop). The browser will warm the
 * page's bundle/JS so navigation feels instant.
 *
 * Usage:
 *   <Link
 *     href="/dashboard"
 *     ref={usePrefetchOnTouch("/dashboard")}
 *   >
 *     Dashboard
 *   </Link>
 *
 * For non-Link elements, use onTouchStart + onMouseEnter handlers:
 *   <div onTouchStart={handleTouch} onMouseEnter={handleTouch}>...</div>
 */
export function usePrefetchOnTouch(href: string) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  return useCallback(
    (el: HTMLAnchorElement | null) => {
      if (!el || prefetchedRef.current) return;
      prefetchedRef.current = true;

      const prefetch = () => {
        router.prefetch(href);
        el.removeEventListener("touchstart", prefetch);
        el.removeEventListener("mouseenter", prefetch);
      };

      el.addEventListener("touchstart", prefetch, { once: true });
      el.addEventListener("mouseenter", prefetch, { once: true });
    },
    [href, router]
  );
}

/**
 * Prefetch hook for non-<Link> components. Returns handlers to attach
 * to onTouchStart/onMouseEnter events.
 */
export function usePrefetchOnTouchHandlers(href: string) {
  const router = useRouter();
  const prefetchedRef = useRef(false);

  const prefetchIfNeeded = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(href);
  }, [href, router]);

  return {
    onTouchStart: prefetchIfNeeded,
    onMouseEnter: prefetchIfNeeded,
  };
}
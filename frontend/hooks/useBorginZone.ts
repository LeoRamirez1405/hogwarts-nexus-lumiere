"use client";

import { usePathname } from "next/navigation";

export const BORGIN_PATH = "/marketplace/borgin-burkes";

/** `true` when the current route is the Borgin & Burkes dark zone. */
export function isBorginRoute(pathname: string): boolean {
  return pathname.startsWith(BORGIN_PATH);
}

/** Reactive helper for layout chrome (AppShell, TopBar, Sidebar, BottomNav). */
export function useBorginZone(): boolean {
  const pathname = usePathname();
  return isBorginRoute(pathname);
}

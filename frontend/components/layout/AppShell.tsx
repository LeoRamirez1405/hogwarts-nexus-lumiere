"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useBorginZone } from "@/hooks/useBorginZone";
import PWAInstallBanner from "@/components/ui/PWAInstallBanner";
import { SWUpdateNotifier } from "@/components/ui/SWUpdateNotifier";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { isKeyboardOpen, keyboardHeight, viewportHeight } = useVisualViewport();
  const isBorgin = useBorginZone();
  const pathname = usePathname();
  const isFullHeight = pathname === "/messages";

  // Dark page-level scrollbar while inside the Borgin & Burkes dark zone.
  useEffect(() => {
    document.documentElement.classList.toggle("dark-scrollbar-html", isBorgin);
    return () => document.documentElement.classList.remove("dark-scrollbar-html");
  }, [isBorgin]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // On /messages (full-height), reset document scroll when keyboard opens
  // to undo any stale browser pan (Chrome resizes-visual behavior) while
  // the layout height adjusts. Only needed during the transition.
  useEffect(() => {
    if (isFullHeight && isKeyboardOpen) {
      window.scrollTo(0, 0);
    }
  }, [isFullHeight, isKeyboardOpen]);

  const keyboardPadding = isKeyboardOpen ? keyboardHeight : 0;

  const fullHeightStyle = mounted
    ? { height: `calc(${viewportHeight}px - var(--bottomnav-h))` }
    : { height: "calc(100dvh - var(--bottomnav-h))" };

  return (
    <div className={`${isFullHeight ? "h-dvh overflow-hidden" : "min-h-screen"} ${isBorgin ? "bg-[#1c1b1b] dark-scrollbar" : "bg-surface"}`}>
      <TopBar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* PWA Install Banner — appears below topbar when installable */}
      <PWAInstallBanner />

      {/* SW Update Notifier */}
      <SWUpdateNotifier />

      {/* Main content — top/bottom padding driven by the layout CSS vars so it
          always clears the top bar and (on mobile) the bottom nav. */}
      <main
        id="main-content"
        className={`lg:pl-72 pt-(--topbar-h) ${isFullHeight ? "overflow-hidden" : "min-h-screen"}`}
        style={
          isFullHeight
            ? fullHeightStyle
            : { paddingBottom: `calc(var(--bottomnav-h) + ${keyboardPadding}px)` }
        }
      >
        <div className={isFullHeight ? "h-full" : "max-w-[1280px] mx-auto px-4 md:px-10 py-6 md:py-8"}>
          {children}
        </div>
      </main>

      <BottomNav />
      <footer role="contentinfo" className="sr-only" aria-hidden="true" />
    </div>
  );
}

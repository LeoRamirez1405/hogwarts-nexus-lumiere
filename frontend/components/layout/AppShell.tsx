"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import { useBorginZone } from "@/hooks/useBorginZone";
import PWAInstallBanner from "@/components/ui/PWAInstallBanner";
import APKInstallBanner from "@/components/ui/APKInstallBanner";
import { SWUpdateNotifier } from "@/components/ui/SWUpdateNotifier";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isKeyboardOpen } = useVisualViewport();
  const isBorgin = useBorginZone();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);
  const isFullHeight = pathname === "/messages";
  // Páginas con composer fijo (estilo chat): el BottomNav se reemplaza por la
  // barra de escribir para dar más espacio al contenido.
  const isComposerPage =
    /^\/posts\/[^/]+$/.test(pathname) ||
    /^\/news\/thread\/[^/]+$/.test(pathname) ||
    /^\/news\/[^/]+$/.test(pathname);

  // Dark page-level scrollbar while inside the Borgin & Burkes dark zone.
  useEffect(() => {
    document.documentElement.classList.toggle("dark-scrollbar-html", isBorgin);
    return () => document.documentElement.classList.remove("dark-scrollbar-html");
  }, [isBorgin]);

  // The window never scrolls in the app-shell layout — main is the only
  // scroller — so restore the scroll position to top on route changes.
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div
      className={`h-dvh flex flex-col overflow-hidden ${
        isBorgin ? "bg-[#1c1b1b] dark-scrollbar" : "bg-surface"
      }`}
    >
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

      {/* APK Install Banner (Android only, authenticated users) */}
      <APKInstallBanner />

      {/* SW Update Notifier */}
      <SWUpdateNotifier />

      {/* Main content — the only scroll container. TopBar/BottomNav are
          in-flow siblings, so they never move while this one scrolls. */}
      <main
        id="main-content"
        ref={mainRef}
        className={`flex-1 min-h-0 lg:pl-72 ${
          isFullHeight ? "overflow-hidden" : "overflow-y-auto overflow-x-hidden"
        }`}
      >
        <div
          className={
            isFullHeight
              ? "h-full flex flex-col"
              : "min-h-full flex flex-col max-w-[1280px] mx-auto px-4 md:px-10 py-6 md:py-8"
          }
        >
          {children}
        </div>
      </main>

      {!isFullHeight && !isComposerPage && !isKeyboardOpen && <BottomNav />}
      <footer role="contentinfo" className="sr-only" aria-hidden="true" />
    </div>
  );
}
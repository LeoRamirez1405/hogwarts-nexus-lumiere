"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface">
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

      {/* Main content — top/bottom padding driven by the layout CSS vars so it
          always clears the top bar and (on mobile) the bottom nav. */}
      <main id="main-content" className="lg:pl-72 min-h-screen pt-[var(--topbar-h)] pb-[var(--bottomnav-h)]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-10 py-6 md:py-8">
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}

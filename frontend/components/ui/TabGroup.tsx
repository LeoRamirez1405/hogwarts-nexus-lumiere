"use client";
import { KeyboardEvent, useCallback, useRef } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { useSwipeable, useReducedMotion } from "@/hooks/useGestures";

type Variant = "light" | "dark";

interface Tab {
  id: string;
  label: string;
  icon?: string;
}

interface TabGroupProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: Variant;
}

export default function TabGroup({
  tabs,
  activeTab,
  onChange,
  variant = "light",
}: TabGroupProps) {
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent, idx: number) => {
      const length = tabs.length;
      let nextIdx: number;
      if (e.key === "ArrowRight") {
        nextIdx = (idx + 1) % length;
      } else if (e.key === "ArrowLeft") {
        nextIdx = (idx - 1 + length) % length;
      } else if (e.key === "Home") {
        nextIdx = 0;
      } else if (e.key === "End") {
        nextIdx = length - 1;
      } else {
        return;
      }
      e.preventDefault();
      tabsRef.current[nextIdx]?.focus();
      onChange(tabs[nextIdx].id);
    },
    [tabs, onChange]
  );

  const handleSwipeLeft = useCallback(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const nextIndex = (currentIndex + 1) % tabs.length;
    onChange(tabs[nextIndex].id);
  }, [tabs, activeTab, onChange]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    onChange(tabs[nextIndex].id);
  }, [tabs, activeTab, onChange]);

  const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useSwipeable({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 40,
    disabled: prefersReducedMotion,
  });

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      role="tablist"
      aria-orientation="horizontal"
      className="flex flex-row gap-2 flex-wrap"
    >
      {tabs.map((tab, idx) => {
        const isActive = tab.id === activeTab;
        const activeStyles =
          variant === "dark"
            ? "bg-secondary text-on-secondary"
            : "bg-primary text-on-primary";
        const inactiveStyles =
          variant === "dark"
            ? "text-secondary hover:bg-inverse-surface/30"
            : "text-on-surface-variant hover:bg-surface-container-high";
        return (
          <button
            key={tab.id}
            ref={(el) => { tabsRef.current[idx] = el; }}
            role="tab"
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            id={`tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={`inline-flex items-center gap-2 rounded-full px-6 py-2 text-body-md font-medium transition-all duration-200 focus:outline-none min-h-[44px] ${isActive ? activeStyles : inactiveStyles}`}
          >
            {tab.icon && <MaterialIcon name={tab.icon} className="text-[1.1em]" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
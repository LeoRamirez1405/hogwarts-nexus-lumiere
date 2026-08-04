"use client";

import { useRef, useEffect, useState, useCallback } from "react";

export function useScheduleMenu() {
  const menuRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }, []);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (e: React.MouseEvent, value: string | undefined, onChange: (value: string | undefined) => void, onCustomClick: () => void) => {
      e.stopPropagation();
      if (value === "custom") {
        onCustomClick();
      } else {
        onChange(value);
      }
      closeMenu();
    },
    [closeMenu]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeMenu]);

  return {
    menuRef,
    isOpen,
    toggleMenu,
    closeMenu,
    handleSelect,
  };
}
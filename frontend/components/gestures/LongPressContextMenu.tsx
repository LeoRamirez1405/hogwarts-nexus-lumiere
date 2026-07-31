"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { MaterialIcon } from "@/components/ui";
import { useLongPress } from "@/hooks/useGestures";
import { useReducedMotion } from "@/hooks/useGestures";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
  shortcut?: string;
}

interface LongPressContextMenuProps {
  children: React.ReactElement;
  items: ContextMenuItem[];
  onOpen?: () => void;
  onClose?: () => void;
  delay?: number;
  disabled?: boolean;
}

export function LongPressContextMenu({
  children,
  items,
  onOpen,
  onClose,
  delay = 500,
  disabled = false,
}: LongPressContextMenuProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const childRef = useRef<HTMLElement>(null);

  const handleLongPress = useCallback(() => {
    if (!targetElement) return;
    const rect = targetElement.getBoundingClientRect();
    setPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
    setIsOpen(true);
    onOpen?.();
  }, [targetElement, onOpen]);

  const { onTouchStart, onTouchEnd, onTouchCancel, onMouseDown, onMouseUp, onMouseLeave } = useLongPress({
    onLongPress: handleLongPress,
    delay,
    disabled: disabled || prefersReducedMotion,
  });

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (!item.disabled) {
      item.onClick();
      closeMenu();
    }
  }, [closeMenu]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        closeMenu();
      }
    }

    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        closeMenu();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, closeMenu]);

  if (!isOpen) {
    return (
      <span
        ref={(el) => {
          childRef.current = el as HTMLElement;
          setTargetElement(el as HTMLElement);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className="inline-block"
      >
        {children}
      </span>
    );
  }

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-[100] pointer-events-none"
      style={{
        left: position.x,
        top: position.y,
        transform: "translate(-50%, -100%)",
      }}
      role="menu"
      aria-orientation="vertical"
    >
      <div
        className="pointer-events-auto glass-card rounded-2xl shadow-2xl min-w-[200px] max-w-[320px] py-2"
        style={{
          animation: prefersReducedMotion ? "none" : "contextMenuIn 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
        }}
      >
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            role="menuitem"
            tabIndex={-1}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left text-body-md transition-colors ${
              item.disabled
                ? "opacity-40 cursor-not-allowed"
                : "hover:bg-surface-container-high"
            } ${item.destructive ? "text-error" : "text-on-surface"}`}
            style={{
              animation: prefersReducedMotion
                ? "none"
                : `contextMenuItemIn 0.15s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${index * 0.03}s both`,
            }}
          >
            {item.icon && (
              <MaterialIcon
                name={item.icon}
                className={`text-xl ${item.destructive ? "text-error" : ""}`}
                filled={item.destructive}
              />
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-label-sm text-on-surface-variant font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <span
        ref={(el) => {
          childRef.current = el as HTMLElement;
          setTargetElement(el as HTMLElement);
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        className="inline-block"
      >
        {children}
      </span>
      {createPortal(menuContent, document.body)}
    </>
  );
}
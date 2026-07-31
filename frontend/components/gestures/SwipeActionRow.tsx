"use client";

import { forwardRef, useImperativeHandle, useRef, useState, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import { useSwipeable } from "@/hooks/useGestures";
import { useReducedMotion } from "@/hooks/useGestures";

export interface SwipeAction {
  label: string;
  icon: string;
  onClick: () => void;
  backgroundColor?: string;
  textColor?: string;
  destructive?: boolean;
}

export interface SwipeActionRowHandle {
  open: (side: "left" | "right") => void;
  close: () => void;
  isOpen: () => boolean;
}

interface SwipeActionRowProps {
  children: React.ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  threshold?: number;
  disabled?: boolean;
  onActionClick?: (action: SwipeAction) => void;
  className?: string;
}

export const SwipeActionRow = forwardRef<SwipeActionRowHandle, SwipeActionRowProps>(
  function SwipeActionRow({
    children,
    leftActions = [],
    rightActions = [],
    threshold = 80,
    disabled = false,
    onActionClick,
    className = "",
  }, ref) {
    const prefersReducedMotion = useReducedMotion();
    const contentRef = useRef<HTMLDivElement>(null);
    const [offsetX, setOffsetX] = useState(0);
    const [openSide, setOpenSide] = useState<"left" | "right" | null>(null);
    const actionsWidthRef = useRef({ left: 0, right: 0 });

    const maxLeftWidth = leftActions.length * 60;
    const maxRightWidth = rightActions.length * 60;

    const handleSwipeLeft = useCallback(() => {
      if (rightActions.length > 0) {
        setOpenSide("right");
        setOffsetX(-maxRightWidth);
        actionsWidthRef.current.right = maxRightWidth;
      }
    }, [rightActions.length, maxRightWidth]);

    const handleSwipeRight = useCallback(() => {
      if (leftActions.length > 0) {
        setOpenSide("left");
        setOffsetX(maxLeftWidth);
        actionsWidthRef.current.left = maxLeftWidth;
      }
    }, [leftActions.length, maxLeftWidth]);

    const handleSwipeUp = useCallback(() => {}, []);
    const handleSwipeDown = useCallback(() => {}, []);

    const { onTouchStart, onTouchMove, onTouchEnd, onMouseDown, onMouseMove, onMouseUp, onMouseLeave } = useSwipeable({
      onSwipeLeft: handleSwipeLeft,
      onSwipeRight: handleSwipeRight,
      onSwipeUp: handleSwipeUp,
      onSwipeDown: handleSwipeDown,
      threshold,
      disabled: disabled || prefersReducedMotion,
    });

    const close = useCallback(() => {
      setOffsetX(0);
      setOpenSide(null);
    }, []);

    const open = useCallback((side: "left" | "right") => {
      if (side === "left" && leftActions.length > 0) {
        setOpenSide("left");
        setOffsetX(maxLeftWidth);
        actionsWidthRef.current.left = maxLeftWidth;
      } else if (side === "right" && rightActions.length > 0) {
        setOpenSide("right");
        setOffsetX(-maxRightWidth);
        actionsWidthRef.current.right = maxRightWidth;
      }
    }, [leftActions.length, rightActions.length, maxLeftWidth, maxRightWidth]);

    const isOpen = useCallback(() => openSide !== null, [openSide]);

    useImperativeHandle(ref, () => ({
      open,
      close,
      isOpen,
    }), [open, close, isOpen]);

    const handleActionClick = useCallback((action: SwipeAction) => {
      action.onClick();
      onActionClick?.(action);
      close();
    }, [onActionClick, close]);

    const renderActions = (actions: SwipeAction[], side: "left" | "right") => (
      <div
        className={`absolute top-0 bottom-0 flex items-center ${side === "left" ? "left-0" : "right-0"}`}
        style={{ width: side === "left" ? maxLeftWidth : maxRightWidth }}
      >
        {actions.map((action, i) => (
          <button
            key={`${side}-${i}`}
            onClick={() => handleActionClick(action)}
            className="flex-1 flex flex-col items-center justify-center gap-1 px-3 py-2 min-w-[60px] transition-colors"
            style={{
              backgroundColor: action.backgroundColor || (action.destructive ? "#ba1a1a" : "#775a19"),
              color: action.textColor || "white",
            }}
            aria-label={action.label}
          >
            <MaterialIcon name={action.icon} className="text-xl" />
            <span className="text-[10px] font-medium leading-none">{action.label}</span>
          </button>
        ))}
      </div>
    );

    const contentStyle: React.CSSProperties = {
      transform: `translateX(${offsetX}px)`,
      transition: prefersReducedMotion ? "none" : "transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
      willChange: "transform",
    };

    return (
      <div
        className={`relative overflow-hidden ${className}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {leftActions.length > 0 && renderActions(leftActions, "left")}
        {rightActions.length > 0 && renderActions(rightActions, "right")}

        <div
          ref={contentRef}
          className="bg-surface relative z-10"
          style={contentStyle}
        >
          {children}
        </div>
      </div>
    );
  }
);

SwipeActionRow.displayName = "SwipeActionRow";
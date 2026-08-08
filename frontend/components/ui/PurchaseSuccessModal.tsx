"use client";

import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { useHapticLight } from "@/hooks/useHapticFeedback";

interface PurchaseSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHECK_SVG = (
  <svg
    viewBox="0 0 48 48"
    className="w-[56px] h-[56px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="4.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{
      strokeDasharray: 56,
      strokeDashoffset: 56,
      animation: "success-check 0.5s cubic-bezier(0.4, 0, 0.2, 1) 0.2s forwards",
    }}
  >
    <path d="M10 24 L20 34 L38 14" />
  </svg>
);

function fireCanvaConfetti() {
  const colors = ["#a855f7", "#ec4899", "#22d3ee", "#facc15", "#4ade80"];

  confetti({
    particleCount: 100,
    startVelocity: 45,
    spread: 360,
    ticks: 200,
    gravity: 0.5,
    decay: 0.94,
    origin: { x: 0.5, y: 0.5 },
    colors,
    shapes: ["square", "circle"],
    scalar: 1.3,
    zIndex: 99999,
    disableForReducedMotion: true,
  });
}

export function PurchaseSuccessModal({ isOpen, onClose }: PurchaseSuccessModalProps) {
  const hapticLight = useHapticLight();
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(isOpen);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      confettiFired.current = false;
      return;
    }

    hapticLight();

    // Fire confetti after paint to ensure proper positioning
    const rafId = requestAnimationFrame(() => {
      if (!confettiFired.current) {
        confettiFired.current = true;
        fireCanvaConfetti();
      }
    });

    const timer = setTimeout(() => {
      setClosing(true);
      setTimeout(onClose, 300);
    }, 2800);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timer);
    };
  }, [isOpen, hapticLight, onClose]);

  // Reset the closing animation state whenever `isOpen` changes, adjusting
  // state during render (documented React pattern) instead of scheduling a
  // synchronous setState inside the effect above.
  if (prevOpen !== isOpen) {
    setPrevOpen(isOpen);
    setClosing(false);
  }
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        animation: closing ? "none" : "fade-in 0.2s ease-out",
        opacity: closing ? 0 : 1,
        transition: "opacity 0.3s ease",
      }}
      onClick={onClose}
      role="alert"
      aria-live="polite"
    >
      <div
        className="relative flex items-center justify-center"
        style={{
          animation: closing ? "none" : "success-pop 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
          opacity: closing ? 0 : 1,
          transition: "opacity 0.2s ease",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="text-success drop-shadow-[0_0_16px_rgba(16,185,129,0.5)]">
          {CHECK_SVG}
        </span>
      </div>
    </div>
  );
}
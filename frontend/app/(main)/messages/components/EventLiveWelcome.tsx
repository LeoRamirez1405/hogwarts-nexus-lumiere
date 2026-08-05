"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "@/components/ui";

interface EventLiveWelcomeProps {
  /** Event title to celebrate, or null to hide. */
  title: string | null;
  subtitle?: string;
  onDone: () => void;
  onOpen?: () => void;
}

const PARTICLES = ["🎉", "✨", "🎊", "⭐", "🎉", "✨"];

/**
 * Personal, one-shot celebration shown when a user enters a group while an
 * event is in progress. Mirrors the level-up / pet-adoption celebration style
 * (reuses the global `lvlup-*` keyframes) but is scoped to the chat overlay.
 */
export default function EventLiveWelcome({ title, subtitle, onDone, onOpen }: EventLiveWelcomeProps) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!title) return;
    const t = setTimeout(() => setClosing(true), 3600);
    const t2 = setTimeout(onDone, 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [title, onDone]);

  if (!title) return null;

  const dismiss = () => {
    setClosing(true);
    setTimeout(onDone, 350);
  };

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        animation: "lvlup-backdrop 0.25s ease-out",
        opacity: closing ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
      onClick={dismiss}
    >
      <div
        className="relative flex flex-col items-center text-center"
        style={{ animation: "lvlup-pop 0.7s cubic-bezier(.16,1,.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-[70px] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {[0, 0.25, 0.5].map((d) => (
            <span
              key={d}
              className="absolute block w-32 h-32 rounded-full bg-gradient-to-br from-fuchsia-300 to-purple-600"
              style={{
                left: "-64px",
                top: "-64px",
                animation: `lvlup-ring 1.6s ease-out ${d}s infinite`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>

        <div className="absolute top-[70px] left-1/2 pointer-events-none" aria-hidden>
          {PARTICLES.map((p, i) => {
            const angle = (i / PARTICLES.length) * Math.PI * 2;
            const dx = Math.cos(angle) * 120;
            const dy = Math.sin(angle) * 120;
            return (
              <span
                key={i}
                className="absolute text-2xl"
                style={
                  {
                    left: 0,
                    top: 0,
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                    animation: `lvlup-particle 1.5s ease-out ${0.1 + i * 0.05}s infinite`,
                  } as React.CSSProperties
                }
              >
                {p}
              </span>
            );
          })}
        </div>

        <div className="relative w-[140px] h-[140px] rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-600 shadow-[0_0_60px_rgba(168,85,247,0.6)] flex items-center justify-center">
          <span className="inline-block" style={{ animation: "lvlup-iconspin 0.9s ease-in-out" }}>
            <MaterialIcon name="celebration" filled className="text-white text-[68px]" />
          </span>
        </div>

        <div className="mt-6 bg-white rounded-3xl px-8 py-6 shadow-2xl max-w-sm">
          <p className="text-label-sm uppercase tracking-[0.2em] text-on-surface-variant mb-1">
            ¡Evento en curso!
          </p>
          <h2 className="font-display text-headline-md text-on-surface mb-1">{title}</h2>
          {subtitle && <p className="text-body-md text-on-surface-variant mb-3">{subtitle}</p>}
          {onOpen && (
            <button
              onClick={() => {
                onOpen();
                dismiss();
              }}
              className="mt-2 inline-flex items-center gap-2 bg-primary text-on-primary px-5 py-2 rounded-full text-label-md font-bold"
            >
              <MaterialIcon name="visibility" className="text-[1.1em]" />
              Ver evento
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

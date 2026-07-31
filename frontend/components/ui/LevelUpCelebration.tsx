"use client";

import { useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

export type LevelUpKind = "pet" | "sanctuary" | "user";

export interface LevelUpEvent {
  id: number;
  kind: LevelUpKind;
  title: string;
  subtitle?: string;
}

const VARIANTS: Record<
  LevelUpKind,
  {
    icon: string;
    heading: string;
    ring: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    particles: string[];
    anim: string;
  }
> = {
  pet: {
    icon: "pets",
    heading: "¡Tu mascota subió de nivel!",
    ring: "from-emerald-300 to-green-500",
    glow: "shadow-[0_0_60px_rgba(16,185,129,0.6)]",
    badgeBg: "bg-emerald-500",
    badgeText: "text-white",
    particles: ["🐾", "✨", "🐾", "💚", "✨", "🐾"],
    anim: "lvlup-pop",
  },
  sanctuary: {
    icon: "castle",
    heading: "¡Tu Santuario creció!",
    ring: "from-violet-300 to-purple-600",
    glow: "shadow-[0_0_60px_rgba(139,92,246,0.6)]",
    badgeBg: "bg-violet-600",
    badgeText: "text-white",
    particles: ["✦", "✧", "⭐", "✦", "🏰", "✧"],
    anim: "lvlup-radiate",
  },
  user: {
    icon: "military_tech",
    heading: "¡Subiste de Nivel Mágico!",
    ring: "from-amber-300 to-orange-500",
    glow: "shadow-[0_0_60px_rgba(245,158,11,0.6)]",
    badgeBg: "bg-amber-500",
    badgeText: "text-white",
    particles: ["🏅", "✨", "⭐", "🎖️", "✨", "🏅"],
    anim: "lvlup-shine",
  },
};

export default function LevelUpCelebration({
  event,
  onDone,
}: {
  event: LevelUpEvent | null;
  onDone: () => void;
}) {
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!event) return;
    const t = setTimeout(() => setClosing(true), 3200);
    const t2 = setTimeout(onDone, 3600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [event, onDone]);

  if (!event) return null;
  const v = VARIANTS[event.kind];

  return (
    <div
      role="alert"
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        animation: "lvlup-backdrop 0.25s ease-out",
        opacity: closing ? 0 : 1,
        transition: "opacity 0.4s ease",
      }}
      onClick={() => {
        setClosing(true);
        setTimeout(onDone, 350);
      }}
    >
      <div
        className="relative flex flex-col items-center text-center"
        style={{ animation: `${v.anim} 0.7s cubic-bezier(.16,1,.3,1)` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-[70px] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          {[0, 0.25, 0.5].map((d) => (
            <span
              key={d}
              className={`absolute block w-32 h-32 rounded-full bg-gradient-to-br ${v.ring}`}
              style={{
                left: "-64px",
                top: "-64px",
                animation: `lvlup-ring 1.6s ease-out ${d}s infinite`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>

        <div
          className="absolute top-[70px] left-1/2 pointer-events-none"
          aria-hidden
        >
          {v.particles.map((p, i) => {
            const angle = (i / v.particles.length) * Math.PI * 2;
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
                    animation: `lvlup-particle 1.5s ease-out ${
                      0.1 + i * 0.05
                    }s infinite`,
                  } as React.CSSProperties
                }
              >
                {p}
              </span>
            );
          })}
        </div>

        <div
          className={`relative w-[140px] h-[140px] rounded-full bg-gradient-to-br ${v.ring} ${v.glow} flex items-center justify-center`}
        >
          <span
            className="inline-block"
            style={{ animation: "lvlup-iconspin 0.9s ease-in-out" }}
          >
            <MaterialIcon
              name={v.icon}
              filled
              className="text-white text-[68px]"
            />
         </span>
        </div>

        <div className="mt-6 bg-white rounded-3xl px-8 py-6 shadow-2xl max-w-sm">
          <p className="text-label-sm uppercase tracking-[0.2em] text-on-surface-variant mb-1">
            {v.heading}
          </p>
          <h2 className="font-display text-headline-md text-on-surface mb-2">
            {event.title}
          </h2>
          {event.subtitle && (
            <span
              className={`inline-block ${v.badgeBg} ${v.badgeText} px-4 py-1.5 rounded-full text-label-md font-bold`}
            >
              {event.subtitle}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
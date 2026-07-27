"use client";

import { useEffect, useState } from "react";

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

const KEYFRAMES = `
@keyframes lvlup-backdrop { from { opacity: 0 } to { opacity: 1 } }
@keyframes lvlup-pop {
  0% { transform: scale(0.4) translateY(20px); opacity: 0 }
  55% { transform: scale(1.12) translateY(0); opacity: 1 }
  70% { transform: scale(0.96) }
  100% { transform: scale(1) }
}
@keyframes lvlup-radiate {
  0% { transform: scale(0.6) rotate(-6deg); opacity: 0 }
  60% { transform: scale(1.08) rotate(2deg); opacity: 1 }
  100% { transform: scale(1) rotate(0) }
}
@keyframes lvlup-shine {
  0% { transform: translateY(24px) scale(0.7); opacity: 0 }
  60% { transform: translateY(0) scale(1.06); opacity: 1 }
  100% { transform: translateY(0) scale(1) }
}
@keyframes lvlup-ring {
  0% { transform: scale(0.7); opacity: 0.9 }
  100% { transform: scale(2.2); opacity: 0 }
}
@keyframes lvlup-particle {
  0% { transform: translate(0,0) scale(0.5); opacity: 0 }
  30% { opacity: 1 }
  100% { transform: translate(var(--dx), var(--dy)) scale(1.1); opacity: 0 }
}
@keyframes lvlup-iconspin {
  0% { transform: rotate(0) scale(1) }
  50% { transform: rotate(10deg) scale(1.15) }
  100% { transform: rotate(0) scale(1) }
}
`;

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
    // Parent remounts this component per event (via `key`), so `closing`
    // starts false; here we only schedule the fade-out and completion.
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
      <style>{KEYFRAMES}</style>

      <div
        className="relative flex flex-col items-center text-center"
        style={{ animation: `${v.anim} 0.7s cubic-bezier(.16,1,.3,1)` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Expanding rings */}
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

        {/* Particles */}
        <div className="absolute top-[70px] left-1/2 pointer-events-none" aria-hidden>
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
                    animation: `lvlup-particle 1.5s ease-out ${0.1 + i * 0.05}s infinite`,
                  } as React.CSSProperties
                }
              >
                {p}
              </span>
            );
          })}
        </div>

        {/* Icon badge */}
        <div
          className={`relative w-[140px] h-[140px] rounded-full bg-gradient-to-br ${v.ring} ${v.glow} flex items-center justify-center`}
        >
          <span
            className="material-symbols-outlined text-white text-[68px]"
            style={{
              fontVariationSettings: '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 48',
              animation: "lvlup-iconspin 0.9s ease-in-out",
            }}
          >
            {v.icon}
          </span>
        </div>

        {/* Text card */}
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

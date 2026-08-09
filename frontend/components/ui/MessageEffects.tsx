"use client";

import { useEffect, useRef, useState } from "react";

export type MessageEffectType =
  | "confetti"
  | "fireworks"
  | "sparkles"
  | "hearts"
  | "magic"
  | "celebration"
  | "lightning"
  | "snow";

interface EffectConfig {
  particles: string[];
  colors: string[];
  duration: number;
  particleCount: number;
  gravity: number;
  spread: number;
}

const EFFECT_CONFIGS: Record<MessageEffectType, EffectConfig> = {
  confetti: {
    particles: ["🎊", "🎉", "✨", "🌈", "⭐", "🎈"],
    colors: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#ff8b94", "#a8e6cf", "#d4a5ff"],
    duration: 3000,
    particleCount: 50,
    gravity: 0.3,
    spread: 360,
  },
  fireworks: {
    particles: ["✨", "💫", "⭐", "🌟", "💥", "🎆"],
    colors: ["#ff3366", "#ffcc00", "#00ffff", "#ff6600", "#cc33ff", "#33ff66"],
    duration: 4000,
    particleCount: 80,
    gravity: 0.15,
    spread: 360,
  },
  sparkles: {
    particles: ["✨", "⭐", "💫", "✦", "✧", "✰"],
    colors: ["#fff9c4", "#ffe082", "#fff176", "#fdd835", "#f9a825"],
    duration: 2000,
    particleCount: 30,
    gravity: 0.05,
    spread: 180,
  },
  hearts: {
    particles: ["💖", "💕", "💗", "💓", "💞", "❤️", "🧡", "💛", "💚", "💙", "💜"],
    colors: ["#ff6b9d", "#ff8fab", "#ffb3d1", "#ffccdd", "#e896c9"],
    duration: 3500,
    particleCount: 40,
    gravity: 0.2,
    spread: 120,
  },
  magic: {
    particles: ["🪄", "✨", "🔮", "🌟", "⭐", "💫", "🧙", "🏰"],
    colors: ["#9b59b6", "#8e44ad", "#bb8fce", "#d2b4de", "#e8daef"],
    duration: 3000,
    particleCount: 35,
    gravity: 0.1,
    spread: 270,
  },
  celebration: {
    particles: ["🎊", "🎉", "🥳", "🎈", "🎁", "🍾", "🥂", "🏆"],
    colors: ["#ff6b6b", "#4ecdc4", "#ffe66d", "#a8e6cf", "#ffd3b6", "#d4a5ff"],
    duration: 4000,
    particleCount: 60,
    gravity: 0.25,
    spread: 360,
  },
  lightning: {
    particles: ["⚡", "💥", "✨", "🌩️", "⚡", "💫"],
    colors: ["#ffff00", "#ffeb3b", "#fff9c4", "#fffde7", "#ffffff"],
    duration: 1500,
    particleCount: 25,
    gravity: 0.02,
    spread: 90,
  },
  snow: {
    particles: ["❄️", "🌨️", "✨", "🌟", "💎", "🧊"],
    colors: ["#e3f2fd", "#bbdefb", "#90caf9", "#64b5f6", "#42a5f5", "#ffffff"],
    duration: 5000,
    particleCount: 40,
    gravity: 0.08,
    spread: 180,
  },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  char: string;
  color: string;
  size: number;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
}

export function MessageEffectBurst({
  type,
  triggerRef,
  onComplete,
}: {
  type: MessageEffectType;
  triggerRef: React.RefObject<HTMLElement | null>;
  onComplete?: () => void;
}) {
  const [particles, setParticles] = useState<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const config = EFFECT_CONFIGS[type];

  useEffect(() => {
    if (!triggerRef.current) {
      onComplete?.();
      return;
    }

    const rect = triggerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const newParticles: Particle[] = Array.from({ length: config.particleCount }, (_, i) => {
      const angle = (Math.random() * config.spread - config.spread / 2) * (Math.PI / 180);
      const speed = 2 + Math.random() * 6;
      return {
        id: i,
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 5,
        char: config.particles[Math.floor(Math.random() * config.particles.length)],
        color: config.colors[Math.floor(Math.random() * config.colors.length)],
        size: 16 + Math.random() * 20,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        opacity: 1,
        life: config.duration,
        maxLife: config.duration,
      };
    });

    setParticles(newParticles);

    let lastTime = performance.now();
    const animate = (time: number) => {
      const dt = time - lastTime;
      lastTime = time;

      setParticles((prev) => {
        const alive = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx * (dt / 16),
            y: p.y + p.vy * (dt / 16),
            vy: p.vy + config.gravity * (dt / 16),
            rotation: p.rotation + p.rotationSpeed * (dt / 16),
            life: p.life - dt,
            opacity: Math.max(0, p.life / p.maxLife),
          }))
          .filter((p) => p.life > 0 && p.opacity > 0);

        if (alive.length === 0) {
          onComplete?.();
          return [];
        }
        return alive;
      });

      if (particles.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [type, triggerRef, config, onComplete, particles.length]);

  if (particles.length === 0) return null;

  return (
    <div
      className="fixed inset-0 pointer-events-none z-[9998]"
      aria-hidden="true"
      style={{ overflow: "hidden" }}
    >
      {particles.map((p) => (
        <span
          key={p.id}
          className="absolute select-none"
          style={{
            left: p.x,
            top: p.y,
            fontSize: `${p.size}px`,
            color: p.color,
            opacity: p.opacity,
            transform: `rotate(${p.rotation}deg)`,
            pointerEvents: "none",
            willChange: "transform, opacity",
            textShadow: "0 2px 4px rgba(0,0,0,0.3)",
          }}
        >
          {p.char}
        </span>
      ))}
    </div>
  );
}

const TRIGGER_MAP: Record<string, MessageEffectType> = {
  "/confetti": "confetti",
  "/fireworks": "fireworks",
  "/sparkles": "sparkles",
  "/hearts": "hearts",
  "/magic": "magic",
  "/celebrate": "celebration",
  "/lightning": "lightning",
  "/snow": "snow",
  "/celebración": "celebration",
  "/fuegos": "fireworks",
  "/corazones": "hearts",
  "/magia": "magic",
  "/nieve": "snow",
  "/brillo": "sparkles",
};

export function detectMessageEffect(text: string): MessageEffectType | null {
  const lower = text.toLowerCase().trim();
  for (const [trigger, effect] of Object.entries(TRIGGER_MAP)) {
    if (lower.includes(trigger)) return effect;
  }
  return null;
}

export function MessageEffectsContainer({
  children,
}: {
  children: React.ReactNode;
}) {
  const [activeEffects, setActiveEffects] = useState<
    Array<{ id: number; type: MessageEffectType; ref: React.RefObject<HTMLElement> }>
  >([]);

  const _triggerEffect = (type: MessageEffectType, element: HTMLElement) => {
    const id = Date.now() + Math.random();
    const ref = { current: element } as React.RefObject<HTMLElement>;
    setActiveEffects((prev) => [...prev, { id, type, ref }]);
    setTimeout(() => {
      setActiveEffects((prev) => prev.filter((e) => e.id !== id));
    }, EFFECT_CONFIGS[type].duration + 500);
  };

  return (
    <>
      {children}
      {activeEffects.map(({ id, type, ref }) => (
        <MessageEffectBurst key={id} type={type} triggerRef={ref} />
      ))}
    </>
  );
}

export function useMessageEffects() {
  const [effects, setEffects] = useState<
    Array<{ id: number; type: MessageEffectType; ref: React.RefObject<HTMLElement> }>
  >([]);

  const trigger = (type: MessageEffectType, element: HTMLElement) => {
    const id = Date.now() + Math.random();
    const ref = { current: element } as React.RefObject<HTMLElement>;
    setEffects((prev) => [...prev, { id, type, ref }]);
    setTimeout(() => {
      setEffects((prev) => prev.filter((e) => e.id !== id));
    }, EFFECT_CONFIGS[type].duration + 500);
  };

  return { effects, trigger };
}
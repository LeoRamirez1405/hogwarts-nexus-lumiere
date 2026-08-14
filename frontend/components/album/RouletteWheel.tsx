"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, motion } from "motion/react";
import { Button, EmptyState, GlassCard, ZerineDisplay } from "@/components/ui";
import { useRoulette } from "@/hooks/useRoulette";
import { useAlbum } from "@/hooks/useAlbum";
import { useAuthStore } from "@/lib/authStore";
import type { RouletteSegment, SpinResult } from "@/lib/api";

const SEGMENT_COLORS = [
  "#0e3b60",
  "#775a19",
  "#2b5278",
  "#8a63c9",
  "#4a7fb5",
  "#c9a227",
  "#31523f",
  "#8c3b2e",
];

function buildWheelSegments(segments: RouletteSegment[]) {
  const total = segments.reduce((acc, s) => acc + s.weight, 0) || 1;
  const step = 360 / segments.length;
  const start = -90;
  return segments.map((seg, i) => {
    const from = start + i * step;
    return {
      ...seg,
      fraction: seg.weight / total,
      path: describeArc(120, 120, 112, from, from + step),
      midAngle: from + step / 2,
      color: SEGMENT_COLORS[i % SEGMENT_COLORS.length],
    };
  });
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const polar = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const s = polar(startAngle);
  const e = polar(endAngle);
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y} L ${cx} ${cy} Z`;
}

const ROTATION_TURNS = 6;

export function RouletteWheel() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { config, history, spinning, spin } = useRoulette();
  const { collection, loading: albumLoading } = useAlbum();
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState<SpinResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const spinInFlight = useRef(false);

  const segments = useMemo(
    () => buildWheelSegments(config?.segments ?? []),
    [config]
  );

  const balance = user?.zerines ?? 0;
  const cost = config?.cost_zerines ?? 100;
  const freeSpins = user?.free_spins ?? 0;
  const canSpin = balance >= cost || freeSpins > 0;

  const isCompleted = collection ? collection.progress >= collection.total : false;

  if (albumLoading) {
    return <p className="py-10 text-center text-sm text-outline">Cargando ruleta…</p>;
  }

  if (isCompleted) {
    return (
      <div className="mx-auto w-full max-w-3xl pb-24">
        <EmptyState
          icon="workspace_premium"
          title="Ya completaste este álbum"
          description="Al completar la edición no puedes girar la ruleta. ¡Espera la próxima edición!"
          actionLabel="Ver mi álbum"
          onAction={() => router.push("/album")}
        />
      </div>
    );
  }

  const handleSpin = async () => {
    if (spinInFlight.current || spinning || !canSpin) return;
    spinInFlight.current = true;
    setShowResult(false);
    const spinResult = await spin();
    if (spinResult) {
      const segIndex = segments.findIndex(
        (s) => s.prize === spinResult.prize && s.label === spinResult.label
      );
      const seg = segIndex >= 0 ? segments[segIndex] : segments[0];
      const current = rotation % 360;
      const landing = ((-90 - seg.midAngle - current) % 360 + 360) % 360;
      const next = current + ROTATION_TURNS * 360 + landing;
      setRotation(current);
      void (async () => {
        await new Promise(r => setTimeout(r, 0));
        animate(current, next, {
          duration: 4.2,
          ease: [0.12, 0.8, 0.16, 1],
          onUpdate: (v) => setRotation(v),
          onComplete: () => {
            setShowResult(true);
            setResult(spinResult);
            spinInFlight.current = false;
          },
        });
      })();
    } else {
      spinInFlight.current = false;
    }
  };

  if (!config) {
    return <p className="py-10 text-center text-sm text-outline">Cargando ruleta…</p>;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 pb-24">
      <h1 className="font-display text-2xl text-primary text-center">Ruleta de la Fortuna Mágica</h1>

      {!config.enabled ? (
        <p className="text-center text-sm text-outline">
          La ruleta está desactivada por el momento. ¡Vuelve pronto!
        </p>
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
            {/* Rueda con botón girar en el centro */}
            <div className="relative" style={{ width: "min(90vw, 380px)", height: "min(90vw, 380px)" }}>
              <motion.svg
                viewBox="0 0 240 240"
                className="h-full w-full drop-shadow-xl"
                style={{ rotate: rotation }}
              >
                {segments.map((seg, i) => (
                  <path key={i} d={seg.path} fill={seg.color} stroke="#fcf9f8" strokeWidth={2} />
                ))}
                {segments.map((seg, i) => {
                  const rad = (seg.midAngle * Math.PI) / 180;
                  const labelR = 72;
                  const x = 120 + labelR * Math.cos(rad);
                  const y = 120 + labelR * Math.sin(rad);
                  return (
                    <text
                      key={i}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-surface text-[9px] font-bold"
                      style={{ transform: `rotate(${seg.midAngle + 90}deg)`, transformOrigin: `${x}px ${y}px` }}
                    >
                      {seg.label}
                    </text>
                  );
                })}
                {/* Hueco central para el botón */}
                <circle cx="120" cy="120" r="34" fill="#fcf9f8" stroke="#775a19" strokeWidth="3" />
              </motion.svg>
              {/* Puntero */}
              <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1/2">
                <span className="material-symbols-outlined rotate-0 text-3xl text-secondary drop-shadow">
                  arrow_drop_down
                </span>
              </div>
              {/* Botón girar en el centro */}
              <button
                onClick={handleSpin}
                disabled={spinning || !canSpin}
                className="absolute left-1/2 top-1/2 z-10 flex h-[18%] w-[18%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-0.5 rounded-full bg-primary text-on-primary shadow-lg transition-all duration-200 hover:opacity-90 active:scale-90 disabled:pointer-events-none disabled:opacity-50"
                aria-label="Girar la ruleta"
              >
                <span className="material-symbols-outlined text-xl">casino</span>
                <span className="text-[10px] font-bold leading-none">
                  {spinning ? "…" : !canSpin ? "Sin 💎" : "Girar"}
                </span>
              </button>
            </div>

            {/* Panel lateral */}
            <div className="w-full max-w-sm space-y-4 lg:w-72">
              <p className="text-center text-[11px] text-outline">
                Cada giro cuesta <span className="font-mono tabular-nums text-secondary">{cost.toLocaleString()}</span> 💎. Premios: sobres, Zerines, XP y más.
                {freeSpins > 0 && (
                  <span className="mt-1 block font-semibold text-primary">
                    Tienes {freeSpins} giro{freeSpins > 1 ? "s" : ""} gratis 🎁
                  </span>
                )}
              </p>

              {/* Resultado */}
              {result && showResult && (
                <GlassCard className="p-4 text-center">
                  <p className="text-[11px] uppercase tracking-widest text-outline">Premio</p>
                  <p className="font-display text-xl text-primary">{result.label}</p>
                  {result.packs_granted.length > 0 && (
                    <p className="mt-1 text-xs text-outline">
                      {result.packs_granted.map((p) => p.pack_type_name).join(" + ")} → tu bandeja
                    </p>
                  )}
                  {result.zerines_won > 0 && (
                    <p className="mt-1 text-sm font-semibold text-secondary">
                       <ZerineDisplay amount={result.zerines_won} variant="price" />
                   </p>
                  )}
                  {result.xp_won > 0 && (
                    <p className="mt-1 text-sm font-semibold text-emerald-700">+{result.xp_won} XP</p>
                  )}
                  {result.free_spins_won > 0 && (
                    <p className="mt-1 text-sm font-semibold text-primary">
                      +{result.free_spins_won} giro{result.free_spins_won > 1 ? "s" : ""} gratis
                    </p>
                  )}
                  <Button
                    className="mt-3 w-full"
                    size="sm"
                    onClick={() => router.push("/album/abrir")}
                  >
                    <span className="material-symbols-outlined mr-1 text-base">redeem</span>
                    Ver mis sobres
                  </Button>
                </GlassCard>
              )}

              {/* Historial */}
              {history.length > 0 && (
                <GlassCard className="p-4">
                  <p className="mb-2 text-[11px] uppercase tracking-widest text-outline">
                    Últimos giros
                  </p>
                  <ul className="space-y-1.5">
                    {history.slice(0, 6).map((h) => (
                      <li key={h.id} className="flex items-center justify-between text-xs">
                        <span className="text-primary">{String(h.result?.label ?? "—")}</span>
                        <span className="font-mono text-outline">
                          {new Date(h.created_at).toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ul>
                </GlassCard>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
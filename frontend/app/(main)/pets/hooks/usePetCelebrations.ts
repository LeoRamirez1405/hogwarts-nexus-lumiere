"use client";

import { useCallback, useRef, useState } from "react";
import type { SanctuaryStats, UserCreature } from "@/lib/api";
import type { UsePetCelebrationsReturn } from "../components/types";

export function usePetCelebrations(): UsePetCelebrationsReturn {
  const [celebrations, setCelebrations] = useState<
    Array<{ id: number; kind: "pet" | "sanctuary" | "user"; title: string; subtitle: string }>
  >([]);
  const petLevels = useRef<Record<string, number>>({});
  const prevSanctuary = useRef<number | null>(null);
  const prevUserLevel = useRef<number | null>(null);
  const celebId = useRef(0);

  const pushCelebration = useCallback(
    (ev: { kind: "pet" | "sanctuary" | "user"; title: string; subtitle: string }) => {
      celebId.current += 1;
      setCelebrations((q) => [...q, { ...ev, id: celebId.current }].slice(-3));
    },
    []
  );

  const applyStats = useCallback(
    (s: SanctuaryStats, celebrate: boolean) => {
      if (celebrate) {
        if (prevSanctuary.current !== null && s.sanctuary_level > prevSanctuary.current) {
          pushCelebration({
            kind: "sanctuary",
            title: `Santuario Nivel ${s.sanctuary_level}`,
            subtitle: `de ${s.sanctuary_max}`,
          });
        }
        if (prevUserLevel.current !== null && s.user_level > prevUserLevel.current) {
          pushCelebration({
            kind: "user",
            title: `Nivel ${s.user_level}`,
            subtitle: s.user_level_name,
          });
        }
      }
      prevSanctuary.current = s.sanctuary_level;
      prevUserLevel.current = s.user_level;
    },
    [pushCelebration]
  );

  const detectPetLevelUp = useCallback(
    (uc: UserCreature) => {
      const prev = petLevels.current[uc.id];
      if (prev !== undefined && uc.level > prev) {
        pushCelebration({
          kind: "pet",
          title: uc.creature?.name ?? "Tu mascota",
          subtitle: `Nivel ${uc.level} · ${uc.level_name}`,
        });
      }
      petLevels.current[uc.id] = uc.level;
    },
    [pushCelebration]
  );

  return {
    celebrations,
    pushCelebration,
    applyStats,
    detectPetLevelUp,
    petLevels,
    setCelebrations,
  };
}
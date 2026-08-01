"use client";

import { useState, useEffect, useCallback } from "react";
import { api, FeatureFlag } from "@/lib/api";
import { useFeatureFlagStore } from "@/lib/featureFlagStore";
import { toastError, toastSuccess } from "@/lib/toastStore";

export function useFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(true);
  const [flagUpdating, setFlagUpdating] = useState<string | null>(null);
  const setFlagInStore = useFeatureFlagStore((s) => s.setFlag);

  useEffect(() => {
    api
      .getFeatureFlags()
      .then(({ items }) => setFlags(items))
      .catch((e) => toastError("No se pudo cargar las secciones", e))
      .finally(() => setFlagsLoading(false));
  }, []);

  const toggleFlag = useCallback(
    async (flag: FeatureFlag) => {
      setFlagUpdating(flag.key);
      try {
        const updated = await api.updateFeatureFlag(flag.key, {
          enabled: !flag.enabled,
        });
        setFlags((prev) =>
          prev.map((f) => (f.key === flag.key ? updated : f))
        );
        setFlagInStore(updated);
        toastSuccess(updated.enabled ? "Sección activada" : "Sección desactivada");
      } catch (e) {
        toastError("No se pudo actualizar la visibilidad de la sección", e);
      }
      setFlagUpdating(null);
    },
    [setFlagInStore]
  );

  return { flags, flagsLoading, flagUpdating, toggleFlag };
}

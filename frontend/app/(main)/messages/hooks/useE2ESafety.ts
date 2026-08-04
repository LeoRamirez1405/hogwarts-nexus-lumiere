"use client";

import { useState, useCallback } from "react";
import { useE2EEncryption } from "@/hooks/useE2EEncryption";
import type { Conversation } from "@/lib/api";

interface UseE2ESafetyOptions {
  selectedId: string | null;
  selectedType: "direct" | "room" | null;
  conversations: Conversation[];
  e2e: ReturnType<typeof useE2EEncryption>;
}

export function useE2ESafety({ selectedId, selectedType, conversations, e2e }: UseE2ESafetyOptions) {
  const [showSafetyNumber, setShowSafetyNumber] = useState(false);

  const handleE2EClick = useCallback(() => {
    if (selectedId && selectedType === "direct") {
      e2e.loadSafetyNumber(selectedId);
      setShowSafetyNumber(true);
    }
  }, [selectedId, selectedType, e2e]);

  const safetyNumber = selectedId ? e2e.safetyNumberStates[selectedId]?.safetyNumber ?? null : null;
  const verified = selectedId ? e2e.safetyNumberStates[selectedId]?.verified ?? false : false;
  const loading = selectedId ? e2e.safetyNumberStates[selectedId]?.loading ?? false : false;
  const remoteUserName = selectedId
    ? conversations.find((c) => c.id === selectedId)?.name || "Usuario"
    : "Usuario";

  return {
    showSafetyNumber,
    setShowSafetyNumber,
    safetyNumber,
    verified,
    loading,
    remoteUserName,
    handleE2EClick,
  };
}
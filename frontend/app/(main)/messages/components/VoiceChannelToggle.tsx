"use client";

import { useState } from "react";
import { MaterialIcon } from "../helpers";

interface VoiceChannelToggleProps {
  roomId: string;
  isActive: boolean;
  isAdmin: boolean;
  onToggle: (roomId: string) => void;
}

export default function VoiceChannelToggle({
  roomId,
  isActive,
  isAdmin,
  onToggle,
}: VoiceChannelToggleProps) {
  const [loading, setLoading] = useState(false);

  if (!isAdmin) return null;

  const handleToggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onToggle(roomId);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
        isActive
          ? "bg-error-container text-on-error-container hover:bg-error-container/80"
          : "bg-primary-container text-on-primary-container hover:bg-primary-container/80"
      }`}
      title={isActive ? "Desactivar chat de voz" : "Activar chat de voz"}
    >
      <MaterialIcon name={isActive ? "call_end" : "mic"} className="text-lg" />
    </button>
  );
}
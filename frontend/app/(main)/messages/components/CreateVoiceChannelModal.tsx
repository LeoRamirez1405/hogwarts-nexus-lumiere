"use client";

import { useState } from "react";
import { Button, BottomSheet, FormField, InputField } from "@/components/ui";
import { voiceChannelsApi } from "@/lib/api/voice_channels";

interface CreateVoiceChannelModalProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateVoiceChannelForm({
  roomId,
  onClose,
  onCreated,
}: CreateVoiceChannelModalProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nombre del canal obligatorio");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await voiceChannelsApi.create(roomId, { name: trimmed });
      onCreated();
      onClose();
    } catch (err) {
      console.error("Failed to create voice channel", err);
      setError("Error al crear el canal de voz");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <FormField label="Nombre del canal" required error={error ?? undefined}>
        <InputField
          value={name}
          onChange={setName}
          placeholder="Nombre del canal..."
          disabled={creating}
          maxLength={80}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
        />
      </FormField>

      <div className="flex gap-3 pt-2">
        <Button variant="secondary" onClick={onClose} className="flex-1" disabled={creating}>
          Cancelar
        </Button>
        <Button
          variant="primary"
          onClick={handleSubmit}
          className="flex-1"
          disabled={creating || !name.trim()}
        >
          {creating ? "Creando..." : "Crear"}
        </Button>
      </div>
    </div>
  );
}

export function CreateVoiceChannelModal(props: CreateVoiceChannelModalProps) {
  return (
    <BottomSheet open={props.isOpen} onClose={props.onClose} title="Crear canal de voz">
      <CreateVoiceChannelForm {...props} />
    </BottomSheet>
  );
}

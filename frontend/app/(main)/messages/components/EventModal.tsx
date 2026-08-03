"use client";

import { useState, useEffect, useCallback } from "react";
import { MaterialIcon } from "@/components/ui";
import BottomSheet from "@/components/ui/BottomSheet";
import Button from "@/components/ui/Button";
import {
  AdminCrudModal,
  FormField,
  InputField,
  TextareaField,
  SelectField,
} from "@/components/ui/AdminCrudModal";
import Switch from "@/components/ui/Switch";
import { format } from "date-fns";
import type { Event, EventCreate, EventUpdate, EventLocationType } from "@/lib/api/events";

interface EventModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: EventCreate | EventUpdate) => Promise<void>;
  initialData?: Event | null;
  roomId: string;
  isLoading?: boolean;
  canCreateVoiceChannel: boolean;
}

const LOCATION_OPTIONS: { value: EventLocationType; label: string }[] = [
  { value: "text_only", label: "Solo chat en el grupo" },
  { value: "physical", label: "Presencial (ubicación física)" },
  { value: "voice_channel", label: "Canal de voz" },
  { value: "external_link", label: "Enlace externo (Zoom, etc.)" },
];

export default function EventModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  roomId,
  isLoading = false,
  canCreateVoiceChannel = true,
}: EventModalProps) {
  const isEditing = !!initialData;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [locationType, setLocationType] = useState<EventLocationType>("text_only");
  const [locationName, setLocationName] = useState("");
  const [locationUrl, setLocationUrl] = useState("");
  const [createVoiceChannel, setCreateVoiceChannel] = useState(false);
  const [voiceChannelName, setVoiceChannelName] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Sync form with initialData when editing
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || "");
      setStartsAt(initialData.starts_at.slice(0, 16)); // YYYY-MM-DDTHH:MM
      setEndsAt(initialData.ends_at ? initialData.ends_at.slice(0, 16) : "");
      setLocationType(initialData.location_type);
      setLocationName(initialData.location_name || "");
      setLocationUrl(initialData.location_url || "");
      setCreateVoiceChannel(false);
      setVoiceChannelName("");
      setMaxAttendees(initialData.max_attendees?.toString() || "");
      setRequireApproval(initialData.require_approval);
    } else {
      // Reset for new event - default to tomorrow at 8pm
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(20, 0, 0, 0);
      setStartsAt(format(tomorrow, "yyyy-MM-dd'T'HH:mm"));
      setEndsAt("");
      setLocationType("text_only");
      setLocationName("");
      setLocationUrl("");
      setCreateVoiceChannel(false);
      setVoiceChannelName("");
      setMaxAttendees("");
      setRequireApproval(false);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = useCallback(() => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = "El título es obligatorio";
    if (!startsAt) newErrors.startsAt = "La fecha de inicio es obligatoria";
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      newErrors.endsAt = "La fecha de fin debe ser posterior al inicio";
    }
    if (locationType === "physical" && !locationName.trim()) {
      newErrors.locationName = "Indica la ubicación";
    }
    if (locationType === "external_link" && !locationUrl.trim()) {
      newErrors.locationUrl = "Indica el enlace";
    }
    if (createVoiceChannel && !voiceChannelName.trim()) {
      newErrors.voiceChannelName = "Nombre del canal obligatorio";
    }
    if (maxAttendees && (parseInt(maxAttendees) < 1 || isNaN(parseInt(maxAttendees)))) {
      newErrors.maxAttendees = "Número inválido";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [title, startsAt, endsAt, locationType, locationName, locationUrl, createVoiceChannel, voiceChannelName, maxAttendees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: EventCreate | EventUpdate = {
      room_id: roomId,
      title: title.trim(),
      description: description.trim() || undefined,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: endsAt ? new Date(endsAt).toISOString() : undefined,
      location_type: locationType,
      location_name: locationName.trim() || undefined,
      location_url: locationUrl.trim() || undefined,
      create_voice_channel: createVoiceChannel,
      voice_channel_name: voiceChannelName.trim() || undefined,
      max_attendees: maxAttendees ? parseInt(maxAttendees) : undefined,
      require_approval: requireApproval,
    };

    if (isEditing && initialData) {
      const updateData: EventUpdate = { ...data };
      delete (updateData as any).room_id;
      delete (updateData as any).create_voice_channel;
      delete (updateData as any).voice_channel_name;
      await onSubmit(updateData);
    } else {
      await onSubmit(data as EventCreate);
    }
  };

  const showLocationName = locationType === "physical";
  const showLocationUrl = locationType === "external_link";
  const showVoiceChannelOptions = locationType === "voice_channel" && !isEditing && canCreateVoiceChannel;

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      title={isEditing ? "Editar evento" : "Crear evento"}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <FormField label="Título del evento" required error={errors.title}>
          <InputField
            value={title}
            onChange={setTitle}
            placeholder="Ej: Torneo de duelos, Fiesta de Navidad..."
            maxLength={100}
            autoFocus
            firstInput
          />
        </FormField>

        {/* Description */}
        <FormField label="Descripción (opcional)">
          <TextareaField
            value={description}
            onChange={setDescription}
            placeholder="Detalles, reglas, qué traer..."
            rows={3}
          />
        </FormField>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block text-label-md text-on-surface">
              Inicio <span className="text-error">*</span>
            </label>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            {errors.startsAt && <p className="text-label-sm text-error">{errors.startsAt}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="block text-label text-on-surface">Fin (opcional)</label>
            <input
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            {errors.endsAt && <p className="text-label-sm text-error">{errors.endsAt}</p>}
          </div>
        </div>

        {/* Location Type */}
        <FormField label="Tipo de evento">
          <SelectField
            value={locationType}
            onChange={(v) => setLocationType(v as EventLocationType)}
            options={LOCATION_OPTIONS}
            placeholder="Seleccionar tipo..."
          />
        </FormField>

        {/* Location Name (physical) */}
        {showLocationName && (
          <FormField label="Ubicación" required error={errors.locationName}>
            <InputField
              value={locationName}
              onChange={setLocationName}
              placeholder="Ej: Sala Común, Gran Comedor, Aula de Pociones..."
            />
          </FormField>
        )}

        {/* Location URL (external link) */}
        {showLocationUrl && (
          <div className="space-y-1.5">
            <label className="block text-label text-on-surface">
              Enlace <span className="text-error">*</span>
            </label>
            <input
              type="url"
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="https://zoom.us/... o https://discord.gg/..."
              className="w-full px-4 py-3 rounded-xl bg-surface-container-low border border-outline-variant/20 text-body-md text-on-surface outline-none focus:border-primary transition-colors"
            />
            {errors.locationUrl && <p className="text-label-sm text-error">{errors.locationUrl}</p>}
          </div>
        )}

        {/* Voice Channel Options */}
        {showVoiceChannelOptions && (
          <div className="space-y-3 p-3 bg-primary-container/20 rounded-xl border border-primary-container/30">
            <div className="flex items-center gap-3">
              <MaterialIcon name="mic" className="text-primary text-lg" />
              <span className="text-body-md font-medium text-on-surface">Canal de voz</span>
            </div>
            <Switch
              checked={createVoiceChannel}
              onChange={setCreateVoiceChannel}
              label="Crear canal de voz automáticamente al iniciar el evento"
            />
            {createVoiceChannel && (
              <FormField label="Nombre del canal" required error={errors.voiceChannelName}>
                <InputField
                  value={voiceChannelName}
                  onChange={setVoiceChannelName}
                  placeholder={title || "Se usará el título del evento"}
                />
              </FormField>
            )}
          </div>
        )}

        {/* Max Attendees */}
        <FormField label="Límite de asistentes (opcional)" error={errors.maxAttendees}>
          <InputField
            type="number"
            min="1"
            value={maxAttendees}
            onChange={setMaxAttendees}
            placeholder="Sin límite"
          />
        </FormField>

        {/* Require Approval */}
        <FormField label="Requiere aprobación del organizador">
          <Switch
            checked={requireApproval}
            onChange={setRequireApproval}
            label="Los usuarios deben ser aprobados tras marcar 'Voy'"
          />
        </FormField>

        {/* Error summary */}
        {Object.keys(errors).length > 0 && (
          <div className="p-3 bg-error-container/20 border border-error/20 rounded-lg">
            <p className="text-label-md text-error font-medium">Revisa los campos marcados</p>
          </div>
        )}

        {/* Submit buttons */}
        <div className="flex gap-3 pt-4">
          <Button variant="secondary" onClick={onClose} className="flex-1" disabled={isLoading}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isLoading} className="flex-1">
            {isLoading ? "Guardando..." : (isEditing ? "Guardar cambios" : "Crear evento")}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}
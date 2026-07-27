"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { useAuthStore } from "@/lib/authStore";
import { GlassCard, Button } from "@/components/ui";

function MaterialIcon({
  name,
  className,
  filled = false,
}: {
  name: string;
  className?: string;
  filled?: boolean;
}) {
  return (
    <span
      className={`material-symbols-outlined ${className ?? ""}`}
      style={{
        fontVariationSettings: filled
          ? '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 24'
          : '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 24',
      }}
    >
      {name}
    </span>
  );
}

type ReportType = "bug" | "suggestion";

export default function SupportPage() {
  const { user } = useAuthStore();
  const [reportType, setReportType] = useState<ReportType>("bug");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("El screenshot no puede superar 5MB");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Solo se permiten imágenes");
      return;
    }
    setScreenshot(file);
    setError(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
  };

  const handleRemoveScreenshot = () => {
    setScreenshot(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (description.trim().length < 10) {
      setError("La descripción debe tener al menos 10 caracteres");
      return;
    }
    setSending(true);
    setError(null);
    try {
      await api.sendSupportReport(reportType, description.trim(), screenshot || undefined);
      setSent(true);
      setDescription("");
      setScreenshot(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al enviar el reporte");
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <GlassCard className="p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-success/10 flex items-center justify-center">
            <MaterialIcon name="check_circle" className="text-4xl text-success" filled />
          </div>
          <h2 className="text-title-md font-display text-on-surface mb-2">
            Reporte enviado
          </h2>
          <p className="text-body-md text-on-surface-variant mb-6">
            Tu reporte ha sido enviado correctamente. Si es un bug, intentaremos
            resolverlo lo antes posible. Si es una sugerencia, la tendremos en cuenta.
          </p>
          <Button
            onClick={() => setSent(false)}
            variant="primary"
          >
            Enviar otro reporte
          </Button>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-headline-lg font-display text-on-surface mb-2 flex items-center gap-3">
          <MaterialIcon name="help" className="text-primary" />
          Soporte
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Encontraste un bug o tienes una sugerencia? Cuéntanos y te
          responderemos por Telegram.
        </p>
      </div>

      <GlassCard className="p-6">
        {/* Type selector */}
        <div className="mb-5">
          <label className="text-label-sm font-semibold text-on-surface uppercase tracking-wider block mb-3">
            Tipo de reporte
          </label>
          <div className="flex gap-3">
            <button
              onClick={() => setReportType("bug")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                reportType === "bug"
                  ? "border-error bg-error/10 text-error"
                  : "border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-outline-variant"
              }`}
            >
              <MaterialIcon
                name="bug_report"
                className="text-xl"
                filled={reportType === "bug"}
              />
              <span className="text-body-md font-medium">Bug</span>
            </button>
            <button
              onClick={() => setReportType("suggestion")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 transition-all duration-200 ${
                reportType === "suggestion"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-outline-variant/30 bg-surface-container-low text-on-surface-variant hover:border-outline-variant"
              }`}
            >
              <MaterialIcon
                name="lightbulb"
                className="text-xl"
                filled={reportType === "suggestion"}
              />
              <span className="text-body-md font-medium">Sugerencia</span>
            </button>
          </div>
        </div>

        {/* User info - read only */}
        <div className="mb-5 p-3 rounded-xl bg-surface-container-low border border-outline-variant/10">
          <p className="text-label-sm text-on-surface-variant">
            Se enviará como: <span className="font-semibold text-on-surface">{user?.name}</span>
            {user?.house && (
              <span className="ml-2 text-on-surface-variant/70">({user.house})</span>
            )}
          </p>
        </div>

        {/* Description */}
        <div className="mb-5">
          <label className="text-label-sm font-semibold text-on-surface uppercase tracking-wider block mb-2">
            Descripción
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError(null);
            }}
            placeholder={
              reportType === "bug"
                ? "Describe el bug con detalle: qué pasaste, qué esperabas ver, qué viste..."
                : "Describe tu sugerencia: qué mejorarías y por qué..."
            }
            rows={5}
            className="w-full bg-surface-container-low border border-outline-variant/20 rounded-xl px-4 py-3 text-body-md text-on-surface placeholder:text-on-surface-variant/50 outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all resize-none"
          />
          <p className="text-label-sm text-on-surface-variant/60 mt-1 text-right">
            {description.length} caracteres
          </p>
        </div>

        {/* Screenshot upload */}
        <div className="mb-6">
          <label className="text-label-sm font-semibold text-on-surface uppercase tracking-wider block mb-2">
            Screenshot (opcional)
          </label>
          {preview ? (
            <div className="relative rounded-xl overflow-hidden border border-outline-variant/20">
              <Image
                src={preview}
                alt="Screenshot preview"
                width={600}
                height={400}
                className="w-full h-auto max-h-64 object-contain bg-black/5"
              />
              <button
                onClick={handleRemoveScreenshot}
                className="absolute top-2 right-2 w-8 h-8 rounded-full bg-error text-white flex items-center justify-center hover:bg-error/90 transition-colors"
              >
                <MaterialIcon name="close" className="text-lg" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-outline-variant/30 rounded-xl py-8 flex flex-col items-center gap-2 text-on-surface-variant hover:border-primary/40 hover:bg-primary/5 transition-all"
            >
              <MaterialIcon name="add_a_photo" className="text-3xl" />
              <span className="text-body-md">Adjuntar screenshot</span>
              <span className="text-label-sm text-on-surface-variant/60">
                PNG, JPG, WebP (max 5MB)
              </span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-error/10 border border-error/20 text-error text-body-md flex items-center gap-2">
            <MaterialIcon name="error" className="text-xl shrink-0" />
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={sending || description.trim().length < 10}
          variant="primary"
          className="w-full"
        >
          {sending ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin material-symbols-outlined text-xl">progress_activity</span>
              Enviando...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <MaterialIcon name="send" className="text-xl" />
              Enviar reporte
            </span>
          )}
        </Button>
      </GlassCard>
    </div>
  );
}

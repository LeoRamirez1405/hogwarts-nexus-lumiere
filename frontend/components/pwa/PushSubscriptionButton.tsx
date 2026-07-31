"use client";

import { usePushSubscription } from "@/hooks/usePWA";
import { MaterialIcon } from "@/components/ui";

interface PushSubscriptionButtonProps {
  variant?: "button" | "inline" | "card";
  className?: string;
}

export default function PushSubscriptionButton({ variant = "button", className = "" }: PushSubscriptionButtonProps) {
  const { isSubscribed, loading, subscribe, unsubscribe } = usePushSubscription();

  if (variant === "card") {
    return (
      <div className={`p-4 bg-surface rounded-2xl border border-outline-variant/20 ${className}`}>
        <div className="flex items-start gap-3">
          <div className={`w-12 h-12 inline-flex items-center justify-center rounded-xl shrink-0 ${
            isSubscribed ? "bg-secondary/10" : "bg-surface-container-high"
          }`}>
            <MaterialIcon
              name={isSubscribed ? "notifications_active" : "notifications_off"}
              className={`text-2xl ${isSubscribed ? "text-secondary" : "text-on-surface-variant"}`}
              filled={isSubscribed}
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-title-md text-on-surface">
              Notificaciones Push
            </h3>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {isSubscribed
                ? "Recibirás notificaciones incluso con la app cerrada"
                : "Activa para recibir avisos de mensajes, ofertas y eventos"}
            </p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {isSubscribed ? (
            <button
              onClick={unsubscribe}
              disabled={loading}
              className="flex-1 py-2.5 text-on-surface font-medium rounded-xl border border-outline-variant/30 hover:bg-surface-container-high transition-colors disabled:opacity-50"
            >
              {loading ? "Desactivando..." : "Desactivar"}
            </button>
          ) : (
            <button
              onClick={subscribe}
              className="flex-1 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors"
            >
              {loading ? "Activando..." : "Activar notificaciones"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-3 px-3 py-2 bg-surface rounded-xl border border-outline-variant/20 ${className}`}>
        <MaterialIcon
          name={isSubscribed ? "notifications_active" : "notifications"}
          className={`text-xl ${isSubscribed ? "text-secondary" : "text-on-surface-variant"}`}
          filled={isSubscribed}
        />
        <span className="text-body-md text-on-surface">
          {isSubscribed ? "Notificaciones activadas" : "Activar notificaciones push"}
        </span>
        <button
          onClick={isSubscribed ? unsubscribe : subscribe}
          disabled={loading}
          className={`px-3 py-1.5 text-label-md rounded-lg font-medium transition-colors shrink-0 ${
            isSubscribed
              ? "text-on-surface-variant hover:bg-surface-container-high"
              : "bg-primary text-white hover:bg-primary/90"
          } disabled:opacity-50`}
        >
          {loading ? "..." : isSubscribed ? "Desactivar" : "Activar"}
        </button>
      </div>
    );
  }

  // Button variant (icon button)
  return (
    <button
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
        isSubscribed
          ? "bg-secondary/10 text-secondary"
          : "text-on-surface-variant hover:bg-surface-container-high"
      } disabled:opacity-50 ${className}`}
      aria-label={isSubscribed ? "Desactivar notificaciones push" : "Activar notificaciones push"}
      title={isSubscribed ? "Notificaciones activadas" : "Activar notificaciones push"}
    >
      <MaterialIcon
        name={isSubscribed ? "notifications_active" : "notifications"}
        className="text-2xl"
        filled={isSubscribed}
      />
    </button>
  );
}